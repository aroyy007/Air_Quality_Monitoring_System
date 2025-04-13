import axios from "axios";
import SensorData from "../models/SensorData.js";
import { calculateAQI } from "../utils/aqiCalculator.js";

export const getWeatherData = async (req, res) => {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) throw new Error("OpenWeatherMap API key missing");

    // Get the most recent sensor data (for display only)
    const sensorData = await SensorData.findOne().sort({ createdAt: -1 }).lean() || {};

    const cityName = process.env.CITY_NAME || "Chittagong,BD";
    const [airPollution, weather] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=22.3569&lon=91.7832&appid=${apiKey}`),
      axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric`),
    ]);

    // Extract API data only
    const apiPollutants = {
      pm25: airPollution.data.list[0].components.pm2_5 || 0,
      pm10: airPollution.data.list[0].components.pm10 || 0,
      o3: airPollution.data.list[0].components.o3 || 0,
      co: airPollution.data.list[0].components.co / 1000 || 0, // Convert from μg/m³ to ppm (divide by ~1000)
      so2: airPollution.data.list[0].components.so2 || 0,
      no2: airPollution.data.list[0].components.no2 || 0,
      nh3: airPollution.data.list[0].components.nh3 || 0
    };

    console.log("API data pollutants:", apiPollutants);
    console.log("Sensor data (for reference):", sensorData);

    // Calculate AQI based on API data only
    const calculatedAQI = calculateAQI(apiPollutants);

    // Use OpenWeatherMap AQI as a reference
    const openWeatherAQI = airPollution.data.list[0].main.aqi;
    // Convert OpenWeatherMap AQI (1-5 scale) to US EPA AQI (0-500 scale)
    const mappedOpenWeatherAQI = {
      1: 25,   // Good (0-50)
      2: 75,   // Fair (51-100)
      3: 125,  // Moderate (101-150)
      4: 175,  // Poor (151-200)
      5: 300   // Very Poor (201+)
    }[openWeatherAQI] || 0;

    console.log("OpenWeatherMap AQI:", openWeatherAQI, "Mapped to:", mappedOpenWeatherAQI);
    console.log("Our calculated AQI:", calculatedAQI);

    // Use the API-based AQI, with fallback to OpenWeatherMap's AQI when there's a large discrepancy
    let finalAQI = calculatedAQI;
    if (Math.abs(calculatedAQI - mappedOpenWeatherAQI) > 50) {
      console.log("Large discrepancy between calculated and OpenWeatherMap AQI, using OpenWeatherMap value");
      finalAQI = mappedOpenWeatherAQI;
    }

    // Create response object that includes both API data (for AQI calculation)
    // and sensor data (for display purposes)
    const responseData = {
      // For display, show API values for main air quality data
      pm25: apiPollutants.pm25,
      pm10: apiPollutants.pm10,
      o3: apiPollutants.o3,
      so2: apiPollutants.so2,
      no2: apiPollutants.no2,
      nh3: apiPollutants.nh3,
      
      // Show sensor data for sensors that are actually connected
      co: sensorData.co || apiPollutants.co,
      methane: sensorData.methane || 0,
      airQuality: sensorData.airQuality || 0,

      // Use the API-based AQI for accuracy
      aqi: finalAQI,

      // Temperature and humidity from weather API
      temperature: weather.data.main.temp || 0,
      humidity: weather.data.main.humidity || 0,
    };

    console.log("Sending weather data:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Weather Data Error:", error.message);
    res.status(500).json({ error: "Failed to fetch weather data", details: error.message });
  }
};

// Historical data function remains unchanged
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