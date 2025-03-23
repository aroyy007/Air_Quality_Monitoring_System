import axios from "axios";
import fs from "fs";
import { parse } from "csv-parse";
import { promisify } from "util";
import path from "path";
import SensorData from "../models/SensorData.js";

const readFile = promisify(fs.readFile);

// Get historical data and make predictions
export const getPrediction = async (req, res) => {
    try {
        // Fetch historical data - last 7 days of sensor readings
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const historicalData = await SensorData.find({ 
            createdAt: { $gte: sevenDaysAgo } 
        }).sort({ createdAt: 1 }).lean();

        if (!historicalData || historicalData.length < 24) {
            // If we don't have enough data, use Dhaka OpenAQ CSV data
            const openaqData = await readOpenAQCSV();
            
            if (!openaqData || openaqData.length === 0) {
                return res.status(400).json({ 
                    error: "Could not read Dhaka data from CSV file" 
                });
            }
            
            // Process OpenAQ data for prediction
            const processedData = processOpenAQData(openaqData);
            const predictions = await makePrediction(processedData);
            
            return res.json({
                source: "openaq_csv",
                predictions
            });
        }

        // Process our sensor data for prediction
        const processedData = processSensorData(historicalData);
        const predictions = await makePrediction(processedData);
        
        return res.json({
            source: "sensor",
            predictions
        });
    } catch (error) {
        console.error("Prediction Error:", error);
        res.status(500).json({ 
            error: "Failed to generate predictions", 
            details: error.message 
        });
    }
};

// Read and parse the downloaded OpenAQ CSV file
async function readOpenAQCSV() {
    try {
        // Assuming the CSV is stored in a data folder at the project root
        const csvPath = path.join(process.cwd(), 'data', 'dhaka_openaq.csv');
        const csvData = await readFile(csvPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            parse(csvData, {
                columns: true, // Treat the first line as header
                skip_empty_lines: true,
                trim: true
            }, (err, records) => {
                if (err) reject(err);
                else resolve(records);
            });
        });
    } catch (error) {
        console.error("CSV Read Error:", error);
        return [];
    }
}

// Process OpenAQ CSV data into format needed for prediction
// Improved to better handle Dhaka's OpenAQ data structure
function processOpenAQData(openaqData) {
    // Group measurements by date and parameter
    const groupedByDate = {};
    
    openaqData.forEach(record => {
        // Extract date (handles different possible formats in OpenAQ data)
        let datetime;
        if (record.date) {
            datetime = record.date.split('T')[0];
        } else if (record.utc) {
            datetime = record.utc.split('T')[0];
        } else if (record.datetime) {
            datetime = record.datetime.split('T')[0];
        } else if (record.timestamp) {
            datetime = record.timestamp.split('T')[0];
        } else if (record.local) {
            datetime = record.local.split('T')[0];
        } else {
            // Use first column if date is not explicitly labeled
            const firstField = Object.keys(record)[0];
            datetime = record[firstField].split('T')[0];
        }
        
        if (!groupedByDate[datetime]) {
            groupedByDate[datetime] = {
                pm25: null, 
                o3: null,
                no2: null, 
                so2: null, 
                co: null,
                count: 0  // Track number of measurements
            };
        }
        
        // Handle various parameter naming conventions in OpenAQ
        const value = parseFloat(record.value);
        //if (isNaN(value)) continue; // Skip invalid values
        
        // Handle different parameter name formats
        let parameter = record.parameter ? record.parameter.toLowerCase() : '';
        
        // Direct parameter mapping
        if (parameter === 'pm25' || parameter === 'pm2.5') {
            groupedByDate[datetime].pm25 = value;
            groupedByDate[datetime].count++;
        } else if (parameter === 'o3' || parameter === 'ozone') {
            groupedByDate[datetime].o3 = value;
            groupedByDate[datetime].count++;
        }
        
        // Handle when data is in columns instead of parameter field
        if (record.pm25 !== undefined && !isNaN(parseFloat(record.pm25))) {
            groupedByDate[datetime].pm25 = parseFloat(record.pm25);
            groupedByDate[datetime].count++;
        } else if (record['pm2.5'] !== undefined && !isNaN(parseFloat(record['pm2.5']))) {
            groupedByDate[datetime].pm25 = parseFloat(record['pm2.5']);
            groupedByDate[datetime].count++;
        } else if (record['PM2.5'] !== undefined && !isNaN(parseFloat(record['PM2.5']))) {
            groupedByDate[datetime].pm25 = parseFloat(record['PM2.5']);
            groupedByDate[datetime].count++;
        }
        
        if (record.o3 !== undefined && !isNaN(parseFloat(record.o3))) {
            groupedByDate[datetime].o3 = parseFloat(record.o3);
            groupedByDate[datetime].count++;
        } else if (record.O3 !== undefined && !isNaN(parseFloat(record.O3))) {
            groupedByDate[datetime].o3 = parseFloat(record.O3);
            groupedByDate[datetime].count++;
        } else if (record.ozone !== undefined && !isNaN(parseFloat(record.ozone))) {
            groupedByDate[datetime].o3 = parseFloat(record.ozone);
            groupedByDate[datetime].count++;
        }
    });
    
    // Convert to array format and filter out dates with insufficient data
    const processedData = Object.entries(groupedByDate)
        .filter(([_, entry]) => entry.count > 0) // At least some data
        .map(([date, entry]) => {
            // For Dhaka data focusing on PM2.5 and O3
            return {
                date,
                pm25: entry.pm25 || 0,
                o3: entry.o3 || 0,
                // Fill other values with zeros or estimated values
                pm10: entry.pm10 || (entry.pm25 ? entry.pm25 * 1.5 : 0), // Estimate PM10 from PM2.5 if not available
                no2: entry.no2 || 0,
                so2: entry.so2 || 0,
                co: entry.co || 0
            };
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date
    
    // Convert to the format expected by the prediction model
    return processedData.map(entry => [
        entry.pm25, 
        entry.pm10,
        entry.o3,
        entry.no2, 
        entry.so2, 
        entry.co
    ]);
}

// Process our sensor data into format needed for prediction
function processSensorData(sensorData) {
    return sensorData.map(reading => [
        reading.pm25 || 0,
        reading.pm10 || 0,
        reading.o3 || 0,
        reading.no2 || 0,
        reading.so2 || 0,
        reading.co || 0
    ]);
}

// Enhanced prediction function to handle the Dhaka OpenAQ data
async function makePrediction(processedData) {
    try {
        // If we don't have enough data points, pad with zeros
        const minRequiredDataPoints = 24; // At least 24 hours of data
        if (processedData.length < minRequiredDataPoints) {
            const paddingNeeded = minRequiredDataPoints - processedData.length;
            // Pad with copies of the first data point or zeros
            const paddingValue = processedData.length > 0 ? 
                processedData[0] : [0, 0, 0, 0, 0, 0];
            
            for (let i = 0; i < paddingNeeded; i++) {
                processedData.unshift([...paddingValue]);
            }
        }
        
        // Get current weather data to improve prediction
        const weatherData = await fetchOpenWeatherData();
        
        // Use Hugging Face API for prediction
        const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
        if (!HF_API_KEY) {
            throw new Error("Hugging Face API key missing");
        }
        
        // Use more specific time series model for environmental data
        const API_URL = "https://api-inference.huggingface.co/models/huggingface/time-series-transformer";
        const headers = { 
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json"
        };
        
        // Normalize data for better model performance
        const normalizedData = normalizeData(processedData);
        
        // If we have weather data, we can augment our input
        let enhancedInput = [...normalizedData]; // Create a copy to avoid modifying original
        if (weatherData) {
            // We'll add weather as additional features
            enhancedInput = addWeatherFeatures(enhancedInput, weatherData);
        }
        
        // Prepare payload in the format expected by the Hugging Face API
        const payload = {
            inputs: {
                past_values: enhancedInput,
                future_length: 24  // Predict next 24 hours
            },
            parameters: {
                num_samples: 1     // Number of prediction samples
            }
        };
        
        console.log("Sending prediction request to Hugging Face API...");
        const response = await axios.post(API_URL, payload, { headers });
        
        // Validate response format
        if (!response.data || typeof response.data !== 'object') {
            throw new Error("Invalid response format from prediction API");
        }
        
        let predictions;
        // Handle different possible response formats
        if (Array.isArray(response.data)) {
            // Direct array response
            predictions = response.data;
        } else if (response.data.predictions) {
            // Object with predictions array
            predictions = response.data.predictions;
        } else {
            console.warn("Unexpected API response format:", response.data);
            throw new Error("Unrecognized prediction API response format");
        }
        
        // Denormalize the predictions back to original scale
        const denormalizedPredictions = denormalizeData(predictions, processedData);
        
        // Convert predictions to AQI values
        const aqiPredictions = denormalizedPredictions.map(pollutants => {
            // Get the first 6 values (pollutants) regardless of how many we sent
            const [pm25, pm10, o3, no2, so2, co] = pollutants.slice(0, 6).map(val => 
                // Ensure positive values
                Math.max(0, val)
            );
            
            // Calculate AQI using EPA method
            const aqiValue = calculateAQIFromPollutants({
                pm25, pm10, o3, no2, so2, co
            });
            
            return {
                aqi: aqiValue,
                pollutants: {
                    pm25, pm10, o3, no2, so2, co
                }
            };
        });
        
        return aqiPredictions;
    } catch (error) {
        console.error("Prediction API Error:", error);
        
        // Fallback to a simple statistical model if API fails
        console.log("Using fallback prediction method...");
        return generateFallbackPrediction(processedData);
    }
}

// Helper function to normalize data for better model performance
function normalizeData(data) {
    // Find min and max for each feature
    const numFeatures = data[0].length;
    const mins = Array(numFeatures).fill(Infinity);
    const maxs = Array(numFeatures).fill(-Infinity);
    
    data.forEach(point => {
        point.forEach((val, i) => {
            mins[i] = Math.min(mins[i], val);
            maxs[i] = Math.max(maxs[i], val);
        });
    });
    
    // Normalize data to [0, 1] range
    return data.map(point => 
        point.map((val, i) => {
            // Handle case where min equals max (constant feature)
            if (mins[i] === maxs[i]) return 0;
            return (val - mins[i]) / (maxs[i] - mins[i]);
        })
    );
}

// Helper function to denormalize data back to original scale
function denormalizeData(normalizedData, originalData) {
    // Find min and max for each feature from original data
    const numFeatures = originalData[0].length;
    const mins = Array(numFeatures).fill(Infinity);
    const maxs = Array(numFeatures).fill(-Infinity);
    
    originalData.forEach(point => {
        point.forEach((val, i) => {
            mins[i] = Math.min(mins[i], val);
            maxs[i] = Math.max(maxs[i], val);
        });
    });
    
    // Denormalize back to original scale
    return normalizedData.map(point => 
        point.slice(0, numFeatures).map((val, i) => {
            // Handle case where min equals max (constant feature)
            if (mins[i] === maxs[i]) return mins[i];
            // Bound predictions within realistic limits (0 to 2x the max)
            const denormalized = val * (maxs[i] - mins[i]) + mins[i];
            return Math.max(0, Math.min(denormalized, maxs[i] * 2));
        })
    );
}

// Add weather features to the input data
function addWeatherFeatures(data, weatherData) {
    if (!weatherData) return data;
    
    // Create a deep copy to avoid modifying the original
    const result = data.map(arr => [...arr]);
    
    // Add weather data as additional features to each time point
    // This is a simple approach - more sophisticated feature engineering could be done
    if (weatherData.temp !== undefined) {
        // Normalize temperature to similar scale as other features
        const normalizedTemp = weatherData.temp / 100;
        result.forEach(point => point.push(normalizedTemp));
    }
    
    if (weatherData.humidity !== undefined) {
        // Humidity is already 0-100 range
        const normalizedHumidity = weatherData.humidity / 100;
        result.forEach(point => point.push(normalizedHumidity));
    }
    
    if (weatherData.wind_speed !== undefined) {
        // Normalize wind speed
        const normalizedWindSpeed = weatherData.wind_speed / 10; 
        result.forEach(point => point.push(normalizedWindSpeed));
    }
    
    return result;
}

// Fetch current weather data from OpenWeatherMap
async function fetchOpenWeatherData() {
    try {
        // Dhaka coordinates
        const lat = 23.8103;
        const lon = 90.4125;
        const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
        
        if (!OPENWEATHER_API_KEY) {
            console.warn("OpenWeatherMap API key missing");
            return null;
        }
        
        const response = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather`, {
                params: {
                    lat,
                    lon,
                    appid: OPENWEATHER_API_KEY,
                    units: 'metric'
                }
            }
        );
        
        if (!response.data) return null;
        
        return {
            temp: response.data.main.temp,
            humidity: response.data.main.humidity,
            wind_speed: response.data.wind.speed,
            weather_condition: response.data.weather[0].main,
            // Add more relevant weather parameters if needed
            pressure: response.data.main.pressure,
            clouds: response.data.clouds ? response.data.clouds.all : null,
            rain: response.data.rain ? response.data.rain['1h'] : 0
        };
    } catch (error) {
        console.error("OpenWeatherMap API Error:", error);
        return null;
    }
}

// Improved fallback prediction method if the Hugging Face API fails
function generateFallbackPrediction(processedData) {
    console.log("Generating fallback predictions...");
    const predictions = [];
    
    // Use more sophisticated time series methods for fallback
    // 1. Get recent trends
    const recentData = processedData.slice(-72); // Last 3 days if hourly data
    
    // If we don't have enough data, repeat what we have
    const dataToUse = recentData.length >= 24 ? recentData : 
        [...Array(24)].map((_, i) => 
            processedData[i % processedData.length] || [0, 0, 0, 0, 0, 0]
        );
    
    // Calculate average and trend for each pollutant
    const numPollutants = dataToUse[0].length;
    const averages = Array(numPollutants).fill(0);
    const trends = Array(numPollutants).fill(0);
    
    // Calculate average values
    dataToUse.forEach(point => {
        point.forEach((val, i) => {
            averages[i] += val / dataToUse.length;
        });
    });
    
    // Calculate trend (average change over recent periods)
    if (dataToUse.length >= 2) {
        for (let i = 1; i < dataToUse.length; i++) {
            dataToUse[i].forEach((val, j) => {
                trends[j] += (val - dataToUse[i-1][j]) / (dataToUse.length - 1);
            });
        }
    }
    
    // Daily and weekly patterns detection (simple approach)
    const hasEnoughData = dataToUse.length >= 24;
    const dailyPatterns = hasEnoughData ? extractDailyPatterns(dataToUse) : null;
    
    // Generate predictions using trend and patterns
    for (let hour = 0; hour < 24; hour++) {
        let predictedPollutants = [];
        
        for (let i = 0; i < numPollutants; i++) {
            // Base prediction: average + trend * hours
            let prediction = averages[i] + (trends[i] * hour);
            
            // Add daily pattern if we have enough data
            if (dailyPatterns) {
                const hourOfDay = (new Date().getHours() + hour) % 24;
                prediction += dailyPatterns[hourOfDay][i];
            }
            
            // Add some small random variation (±5%)
            const variation = prediction * (Math.random() * 0.1 - 0.05);
            
            // Ensure prediction is positive
            predictedPollutants.push(Math.max(0, prediction + variation));
        }
        
        const [pm25, pm10, o3, no2, so2, co] = predictedPollutants;
        
        const aqiValue = calculateAQIFromPollutants({
            pm25, pm10, o3, no2, so2, co
        });
        
        predictions.push({
            aqi: aqiValue,
            pollutants: {
                pm25, pm10, o3, no2, so2, co
            }
        });
    }
    
    return predictions;
}

// Helper function to extract daily patterns from historical data
function extractDailyPatterns(data) {
    // Assuming data has at least 24 hours and is ordered by time
    const numPollutants = data[0].length;
    const hourlyAverages = Array(24).fill().map(() => Array(numPollutants).fill(0));
    const hourlyCount = Array(24).fill(0);
    
    // Group by hour of day and calculate averages
    data.forEach((point, idx) => {
        // This is a simplification - in a real app, you'd use actual timestamps
        const hour = idx % 24;
        hourlyCount[hour]++;
        
        point.forEach((val, i) => {
            hourlyAverages[hour][i] += val;
        });
    });
    
    // Calculate average deviations from overall average for each hour
    const patterns = hourlyAverages.map((hourAvg, hour) => {
        return hourAvg.map((total, i) => {
            if (hourlyCount[hour] === 0) return 0;
            const hourlyAverage = total / hourlyCount[hour];
            // Return deviation from overall average
            return hourlyAverage - hourlyAverages[i];
        });
    });
    
    return patterns;
}

// AQI calculation functions
function calculateAQIFromPollutants(pollutants) {
    const indices = [];
    
    // For Dhaka data, focus primarily on PM2.5 and O3 which are most reliable
    if (pollutants.pm25 !== undefined && pollutants.pm25 !== null) {
        indices.push(calculatePM25Index(pollutants.pm25));
    }
    
    if (pollutants.o3 !== undefined && pollutants.o3 !== null) {
        indices.push(calculateO3Index(pollutants.o3));
    }
    
    // Add other pollutants if available
    if (pollutants.pm10 !== undefined && pollutants.pm10 !== null) {
        indices.push(calculatePM10Index(pollutants.pm10));
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

// Original AQI calculation functions remain unchanged
function calculatePM25Index(pm25) {
    if (pm25 <= 12.0) return linearScale(pm25, 0, 12.0, 0, 50);
    else if (pm25 <= 35.4) return linearScale(pm25, 12.1, 35.4, 51, 100);
    else if (pm25 <= 55.4) return linearScale(pm25, 35.5, 55.4, 101, 150);
    else if (pm25 <= 150.4) return linearScale(pm25, 55.5, 150.4, 151, 200);
    else if (pm25 <= 250.4) return linearScale(pm25, 150.5, 250.4, 201, 300);
    else if (pm25 <= 350.4) return linearScale(pm25, 250.5, 350.4, 301, 400);
    else return linearScale(pm25, 350.5, 500.4, 401, 500);
}

function calculatePM10Index(pm10) {
    if (pm10 <= 54) return linearScale(pm10, 0, 54, 0, 50);
    else if (pm10 <= 154) return linearScale(pm10, 55, 154, 51, 100);
    else if (pm10 <= 254) return linearScale(pm10, 155, 254, 101, 150);
    else if (pm10 <= 354) return linearScale(pm10, 255, 354, 151, 200);
    else if (pm10 <= 424) return linearScale(pm10, 355, 424, 201, 300);
    else if (pm10 <= 504) return linearScale(pm10, 425, 504, 301, 400);
    else return linearScale(pm10, 505, 604, 401, 500);
}

function calculateO3Index(o3) {
    if (o3 <= 54) return linearScale(o3, 0, 54, 0, 50);
    else if (o3 <= 70) return linearScale(o3, 55, 70, 51, 100);
    else if (o3 <= 85) return linearScale(o3, 71, 85, 101, 150);
    else if (o3 <= 105) return linearScale(o3, 86, 105, 151, 200);
    else if (o3 <= 200) return linearScale(o3, 106, 200, 201, 300);
    else return linearScale(o3, 201, 504, 301, 500);
}

function calculateCOIndex(co) {
    if (co <= 4.4) return linearScale(co, 0, 4.4, 0, 50);
    else if (co <= 9.4) return linearScale(co, 4.5, 9.4, 51, 100);
    else if (co <= 12.4) return linearScale(co, 9.5, 12.4, 101, 150);
    else if (co <= 15.4) return linearScale(co, 12.5, 15.4, 151, 200);
    else if (co <= 30.4) return linearScale(co, 15.5, 30.4, 201, 300);
    else if (co <= 40.4) return linearScale(co, 30.5, 40.4, 301, 400);
    else return linearScale(co, 40.5, 50.4, 401, 500);
}

function calculateSO2Index(so2) {
    if (so2 <= 35) return linearScale(so2, 0, 35, 0, 50);
    else if (so2 <= 75) return linearScale(so2, 36, 75, 51, 100);
    else if (so2 <= 185) return linearScale(so2, 76, 185, 101, 150);
    else if (so2 <= 304) return linearScale(so2, 186, 304, 151, 200);
    else if (so2 <= 604) return linearScale(so2, 305, 604, 201, 300);
    else if (so2 <= 804) return linearScale(so2, 605, 804, 301, 400);
    else return linearScale(so2, 805, 1004, 401, 500);
}

function calculateNO2Index(no2) {
    if (no2 <= 53) return linearScale(no2, 0, 53, 0, 50);
    else if (no2 <= 100) return linearScale(no2, 54, 100, 51, 100);
    else if (no2 <= 360) return linearScale(no2, 101, 360, 101, 150);
    else if (no2 <= 649) return linearScale(no2, 361, 649, 151, 200);
    else if (no2 <= 1249) return linearScale(no2, 650, 1249, 201, 300);
    else if (no2 <= 1649) return linearScale(no2, 1250, 1649, 301, 400);
    else return linearScale(no2, 1650, 2049, 401, 500);
}

function linearScale(concentration, minConc, maxConc, minAQI, maxAQI) {
    return Math.round(
        ((maxAQI - minAQI) / (maxConc - minConc)) * (concentration - minConc) + minAQI
    );
}