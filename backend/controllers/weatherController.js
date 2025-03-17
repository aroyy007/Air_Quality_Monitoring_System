import axios from "axios";
import SensorData from "../models/SensorData.js";

// AQI Calculation Functions
function calculatePM25Index(pm25) {
  // EPA breakpoints for PM2.5 (μg/m³)
  if (pm25 <= 12.0) return linearScale(pm25, 0, 12.0, 0, 50);
  else if (pm25 <= 35.4) return linearScale(pm25, 12.1, 35.4, 51, 100);
  else if (pm25 <= 55.4) return linearScale(pm25, 35.5, 55.4, 101, 150);
  else if (pm25 <= 150.4) return linearScale(pm25, 55.5, 150.4, 151, 200);
  else if (pm25 <= 250.4) return linearScale(pm25, 150.5, 250.4, 201, 300);
  else if (pm25 <= 350.4) return linearScale(pm25, 250.5, 350.4, 301, 400);
  else return linearScale(pm25, 350.5, 500.4, 401, 500);
}

function calculatePM10Index(pm10) {
  // EPA breakpoints for PM10 (μg/m³)
  if (pm10 <= 54) return linearScale(pm10, 0, 54, 0, 50);
  else if (pm10 <= 154) return linearScale(pm10, 55, 154, 51, 100);
  else if (pm10 <= 254) return linearScale(pm10, 155, 254, 101, 150);
  else if (pm10 <= 354) return linearScale(pm10, 255, 354, 151, 200);
  else if (pm10 <= 424) return linearScale(pm10, 355, 424, 201, 300);
  else if (pm10 <= 504) return linearScale(pm10, 425, 504, 301, 400);
  else return linearScale(pm10, 505, 604, 401, 500);
}

function calculateO3Index(o3) {
  // EPA breakpoints for O3 (ppb)
  if (o3 <= 54) return linearScale(o3, 0, 54, 0, 50);
  else if (o3 <= 70) return linearScale(o3, 55, 70, 51, 100);
  else if (o3 <= 85) return linearScale(o3, 71, 85, 101, 150);
  else if (o3 <= 105) return linearScale(o3, 86, 105, 151, 200);
  else if (o3 <= 200) return linearScale(o3, 106, 200, 201, 300);
  else return linearScale(o3, 201, 504, 301, 500);
}

function calculateCOIndex(co) {
  // EPA breakpoints for CO (ppm)
  if (co <= 4.4) return linearScale(co, 0, 4.4, 0, 50);
  else if (co <= 9.4) return linearScale(co, 4.5, 9.4, 51, 100);
  else if (co <= 12.4) return linearScale(co, 9.5, 12.4, 101, 150);
  else if (co <= 15.4) return linearScale(co, 12.5, 15.4, 151, 200);
  else if (co <= 30.4) return linearScale(co, 15.5, 30.4, 201, 300);
  else if (co <= 40.4) return linearScale(co, 30.5, 40.4, 301, 400);
  else return linearScale(co, 40.5, 50.4, 401, 500);
}

function calculateSO2Index(so2) {
  // EPA breakpoints for SO2 (ppb)
  if (so2 <= 35) return linearScale(so2, 0, 35, 0, 50);
  else if (so2 <= 75) return linearScale(so2, 36, 75, 51, 100);
  else if (so2 <= 185) return linearScale(so2, 76, 185, 101, 150);
  else if (so2 <= 304) return linearScale(so2, 186, 304, 151, 200);
  else if (so2 <= 604) return linearScale(so2, 305, 604, 201, 300);
  else if (so2 <= 804) return linearScale(so2, 605, 804, 301, 400);
  else return linearScale(so2, 805, 1004, 401, 500);
}

function calculateNO2Index(no2) {
  // EPA breakpoints for NO2 (ppb)
  if (no2 <= 53) return linearScale(no2, 0, 53, 0, 50);
  else if (no2 <= 100) return linearScale(no2, 54, 100, 51, 100);
  else if (no2 <= 360) return linearScale(no2, 101, 360, 101, 150);
  else if (no2 <= 649) return linearScale(no2, 361, 649, 151, 200);
  else if (no2 <= 1249) return linearScale(no2, 650, 1249, 201, 300);
  else if (no2 <= 1649) return linearScale(no2, 1250, 1649, 301, 400);
  else return linearScale(no2, 1650, 2049, 401, 500);
}

// Linear interpolation function for AQI calculation
function linearScale(concentration, minConc, maxConc, minAQI, maxAQI) {
  return Math.round(
    ((maxAQI - minAQI) / (maxConc - minConc)) * (concentration - minConc) + minAQI
  );
}

// Calculate overall AQI based on all pollutants
function calculateAQI(pollutants) {
  const indices = [];
  
  if (pollutants.pm25 !== undefined && pollutants.pm25 !== null) {
    indices.push(calculatePM25Index(pollutants.pm25));
  }
  
  if (pollutants.pm10 !== undefined && pollutants.pm10 !== null) {
    indices.push(calculatePM10Index(pollutants.pm10));
  }
  
  if (pollutants.o3 !== undefined && pollutants.o3 !== null) {
    indices.push(calculateO3Index(pollutants.o3));
  }
  
  if (pollutants.co !== undefined && pollutants.co !== null) {
    indices.push(calculateCOIndex(pollutants.co));
  }
  
  if (pollutants.so2 !== undefined && pollutants.so2 !== null) {
    indices.push(calculateSO2Index(pollutants.so2));
  }
  
  if (pollutants.no2 !== undefined && pollutants.no2 !== null) {
    indices.push(calculateNO2Index(pollutants.no2));
  }
  
  // AQI is the maximum of all pollutant indices
  return indices.length > 0 ? Math.max(...indices) : 0;
}

export const getWeatherData = async (req, res) => {
    try {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) throw new Error("OpenWeatherMap API key missing");

        // Get the most recent sensor data
        const sensorData = await SensorData.findOne().sort({ createdAt: -1 }).lean() || {};

        const cityName = process.env.CITY_NAME || "Chittagong,BD";
        const [airPollution, weather] = await Promise.all([
            axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=22.3569&lon=91.7832&appid=${apiKey}`),
            axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`),
        ]);

        // Extract API data
        const apiPollutants = {
            pm25: airPollution.data.list[0].components.pm2_5 || 0,
            pm10: airPollution.data.list[0].components.pm10 || 0,
            o3: airPollution.data.list[0].components.o3 || 0,
            co: airPollution.data.list[0].components.co || 0,
            so2: airPollution.data.list[0].components.so2 || 0,
            no2: airPollution.data.list[0].components.no2 || 0,
            nh3: airPollution.data.list[0].components.nh3 || 0
        };

        // Merge sensor data with API data, prioritizing sensor data when available
        const mergedPollutants = {
            pm25: sensorData.pm25 || apiPollutants.pm25,
            pm10: sensorData.pm10 || apiPollutants.pm10,
            o3: sensorData.o3 || apiPollutants.o3,
            co: sensorData.co || apiPollutants.co,
            so2: sensorData.so2 || apiPollutants.so2,
            no2: sensorData.no2 || apiPollutants.no2,
            nh3: sensorData.nh3 || apiPollutants.nh3
        };

        // Calculate AQI if not provided by sensor
        const calculatedAQI = calculateAQI(mergedPollutants);

        const responseData = {
            // Prioritize sensor data for these values
            co: sensorData.co || apiPollutants.co,
            methane: sensorData.methane || 0,
            airQuality: sensorData.airQuality || 0,
            
            // Use calculated AQI or fallback to sensor/API AQI
            aqi: sensorData.aqi || calculatedAQI || airPollution.data.list[0].main.aqi || 0,
            
            // Temperature and humidity from weather API
            temperature: sensorData.temperature || weather.data.main.temp || 0,
            humidity: sensorData.humidity || weather.data.main.humidity || 0,
            
            // Air pollution components
            pm25: mergedPollutants.pm25,
            pm10: mergedPollutants.pm10,
            o3: mergedPollutants.o3,
            so2: mergedPollutants.so2,
            no2: mergedPollutants.no2,
            nh3: mergedPollutants.nh3,
        };

        console.log("Sending weather data:", responseData);
        res.json(responseData);
    } catch (error) {
        console.error("Weather Data Error:", error.message);
        res.status(500).json({ error: "Failed to fetch weather data", details: error.message });
    }
};

export const getHistoricalData = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const data = await SensorData.find({ createdAt: { $gte: thirtyDaysAgo } })
            .sort({ createdAt: 1 })
            .lean();

        if (!data || data.length === 0) return res.json([]);

        const groupedByDay = {};
        data.forEach((entry) => {
            const date = new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            if (!groupedByDay[date]) {
                groupedByDay[date] = { count: 1, totalAqi: entry.aqi || 0 };
            } else {
                groupedByDay[date].count++;
                groupedByDay[date].totalAqi += entry.aqi || 0;
            }
        });

        const formattedData = Object.keys(groupedByDay).map((date) => ({
            date,
            aqi: Math.round(groupedByDay[date].totalAqi / groupedByDay[date].count),
        }));

        res.json(formattedData);
    } catch (error) {
        console.error("Historical Data Error:", error);
        res.status(500).json({ error: "Failed to fetch historical data", details: error.message });
    }
};