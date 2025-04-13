import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import sensorRoutes from "./routes/sensorRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import predictionRoutes from "./routes/predictionRoutes.js"; // Add this
import mongoose from "mongoose";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import SensorData from "./models/SensorData.js";
import { checkAndSendAlerts } from "./controllers/emailController.js";
import axios from "axios";


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:8080" }));

connectDB();

app.use("/api/sensors", sensorRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/alerts", emailRoutes);
app.use("/api/predictions", predictionRoutes); // Add this route

app.get("/", (req, res) => res.send("API is running..."));

// Initialize arduinoPortInstance first
let arduinoPortInstance = null;

// Connect to Arduino port
(async () => {
    try {
        // Try to connect directly to COM3 since we know that's our Arduino
        const arduinoPort = "COM3";

        console.log(`Attempting to connect to port: ${arduinoPort}`);

        // Make sure no other program is using COM3 before trying to open it
        const ports = await SerialPort.list();
        // console.log("Available ports:", ports);

        // Create the SerialPort instance
        arduinoPortInstance = new SerialPort({
            path: arduinoPort,
            baudRate: 9600,
            autoOpen: false, // Don't open immediately
        });

        // Open the port with error handling
        arduinoPortInstance.open((err) => {
            if (err) {
                console.error("Serial Port Error:", err.message);
                if (err.message.includes("Access denied")) {
                    console.error("Access denied. Try running this app as an administrator or close other applications using the port.");
                }
                return;
            }

            console.log("Serial port opened successfully");

            // Set up parser and data handling once connected
            const parser = arduinoPortInstance.pipe(new ReadlineParser({ delimiter: "\r\n" }));

            // In server.js, inside the parser.on("data") handler
            parser.on("data", async (rawData) => {
                try {
                    // Your existing code to parse Arduino data
                    const trimmedData = rawData.trim();
                    if (!trimmedData || trimmedData === "") {
                        console.log("Empty data received from Arduino, skipping");
                        return;
                    }

                    const sensorData = JSON.parse(trimmedData);
                    console.log("Received from Arduino:", sensorData);

                    // Validate Arduino data
                    if (typeof sensorData !== 'object') {
                        throw new Error("Invalid data format from Arduino");
                    }

                    // Fetch current weather/air quality data from OpenWeatherMap
                    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
                    if (apiKey) {
                        try {
                            const [airPollution, weather] = await Promise.all([
                                axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=22.3569&lon=91.7832&appid=${apiKey}`),
                                axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${process.env.CITY_NAME || "Chittagong,BD"}&appid=${apiKey}&units=metric`),
                            ]);

                            // Extract API pollution data
                            const components = airPollution.data.list[0].components;

                            // Create new sensor data entry with both Arduino and API data
                            const newEntry = new SensorData({
                                // Arduino sensor values
                                co: parseFloat(sensorData.co) || 0,
                                methane: parseFloat(sensorData.methane) || 0,
                                airQuality: parseFloat(sensorData.airQuality) || 0,

                                // Weather API values
                                temperature: weather.data.main.temp || 0,
                                humidity: weather.data.main.humidity || 0,

                                // Air pollution API values
                                pm25: components.pm2_5 || 0,
                                pm10: components.pm10 || 0,
                                o3: components.o3 || 0,
                                so2: components.so2 || 0,
                                no2: components.no2 || 0,
                                nh3: components.nh3 || 0,

                                // Calculate AQI here if needed or use the API's AQI
                                aqi: airPollution.data.list[0].main.aqi || 0,
                            });

                            await newEntry.save();
                            console.log("Saved combined Arduino + API data to DB:", newEntry);
                            checkAndSendAlerts();
                        } catch (apiError) {
                            console.error("Failed to fetch API data:", apiError.message);

                            // Fall back to saving only Arduino data
                            const newEntry = new SensorData({
                                co: parseFloat(sensorData.co) || 0,
                                methane: parseFloat(sensorData.methane) || 0,
                                airQuality: parseFloat(sensorData.airQuality) || 0,
                                aqi: 0, // Calculate if possible
                                temperature: 0,
                                humidity: 0,
                                pm25: 0,
                                pm10: 0,
                                o3: 0,
                                so2: 0,
                                no2: 0,
                                nh3: 0,
                            });

                            await newEntry.save();
                            console.log("Saved Arduino-only data to DB (API fetch failed):", newEntry);
                            checkAndSendAlerts();
                        }
                    } else {
                        // No API key available, save only Arduino data
                        const newEntry = new SensorData({
                            co: parseFloat(sensorData.co) || 0,
                            methane: parseFloat(sensorData.methane) || 0,
                            airQuality: parseFloat(sensorData.airQuality) || 0,
                            aqi: 0, // Calculate if possible
                            temperature: 0,
                            humidity: 0,
                            pm25: 0,
                            pm10: 0,
                            o3: 0,
                            so2: 0,
                            no2: 0,
                            nh3: 0,
                        });

                        await newEntry.save();
                        console.log("Saved Arduino-only data to DB (no API key):", newEntry);
                        checkAndSendAlerts();
                    }
                } catch (error) {
                    console.error("Arduino Parse/Save Error:", error.message, "Raw data:", rawData);
                }
            });

            arduinoPortInstance.on("error", (err) => {
                console.error("Serial Port Error:", err.message);
            });

            arduinoPortInstance.on("close", () => {
                console.log("Serial port closed");
                // Try to reconnect later
                setTimeout(() => {
                    console.log("Attempting to reconnect...");
                    arduinoPortInstance.open();
                }, 5000);
            });
        });
    } catch (error) {
        console.error("Serial Port Init Error:", error.message);
        console.log("No Arduino connected. Sensor data will default to 0.");
    }
})();

// Set up alert check interval (every 15 minutes)
const ALERT_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes in milliseconds
console.log(`Setting up alert check interval: ${ALERT_CHECK_INTERVAL / 60000} minutes`);

const alertCheckInterval = setInterval(async () => {
    console.log("Running scheduled alert check...");
    try {
        const count = await checkAndSendAlerts();
        console.log(`Alert check complete: Sent ${count || 0} notifications`);
    } catch (error) {
        console.error("Alert Check Error:", error);
    }
}, ALERT_CHECK_INTERVAL);

// Run an initial check when the server starts
(async () => {
    try {
        console.log("Running initial alert check...");
        const count = await checkAndSendAlerts();
        console.log(`Initial alert check complete: Sent ${count || 0} notifications`);
    } catch (error) {
        console.error("Initial Alert Check Error:", error);
    }
})();

const PORT = process.env.PORT || 5001; // Change to 5001 or any other available port
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));