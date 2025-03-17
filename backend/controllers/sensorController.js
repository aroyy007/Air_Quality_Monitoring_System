import SensorData from "../models/SensorData.js";

// Store sensor data from Arduino
export const saveSensorData = async (req, res) => {
    try {
        const { 
            aqi, temperature, humidity, pm25, pm10, co, 
            methane, airQuality, o3, so2, no2, nh3 
        } = req.body;
        
        // Create new SensorData document with all available fields
        const data = new SensorData({ 
            aqi, temperature, humidity, pm25, pm10, co, 
            methane, airQuality, o3, so2, no2, nh3 
        });

        await data.save();
        console.log("Saved sensor data:", data);
        res.status(201).json({ message: "Sensor data saved successfully" });
    } catch (error) {
        console.error("Error saving sensor data:", error);
        res.status(500).json({ error: "Failed to save data", details: error.message });
    }
};

// Fetch latest sensor data
export const getSensorData = async (req, res) => {
    try {
        const data = await SensorData.find().sort({ createdAt: -1 }).limit(1);
        console.log("Fetched sensor data:", data[0] || {});
        res.json(data[0] || {});
    } catch (error) {
        console.error("Error fetching sensor data:", error);
        res.status(500).json({ error: "Failed to fetch data", details: error.message });
    }
};