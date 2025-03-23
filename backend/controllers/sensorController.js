import SensorData from "../models/SensorData.js";


export const saveSensorData = async (req, res) => {
    try {
        // Log the entire request body to inspect what's being received
        console.log("Full request body:", req.body);
        
        // Extract all fields from request body
        const { 
            aqi, temperature, humidity, pm25, pm10, co, 
            methane, airQuality, o3, so2, no2, nh3 
        } = req.body;
        
        console.log("Received from Arduino:", { 
            methane: req.body.methane, 
            airQuality: req.body.airQuality,
            co: req.body.co,
            pm25: req.body.pm25,
            pm10: req.body.pm10
        });
        
        // Create data object with values from req.body directly
        const sensorData = {
            aqi: aqi || 0,
            temperature: temperature || 0,
            humidity: humidity || 0,
            pm25: pm25 || 0,
            pm10: pm10 || 0,
            co: co || 0,
            methane: req.body.methane || 0,     // Use direct property access
            airQuality: req.body.airQuality || 0, // Use direct property access
            o3: o3 || 0,
            so2: so2 || 0,
            no2: no2 || 0,
            nh3: nh3 || 0
        };
        
        // Create new SensorData document with prepared data
        const data = new SensorData(sensorData);
        await data.save();
        console.log("Saved sensor data:", data);
        res.status(201).json({ message: "Sensor data saved successfully", data: data });
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