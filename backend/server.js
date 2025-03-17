import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import sensorRoutes from "./routes/sensorRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import mongoose from "mongoose";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import SensorData from "./models/SensorData.js";
import { checkAndSendAlerts } from "./controllers/emailController.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:8080" }));

connectDB();

app.use("/api/sensors", sensorRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/alerts", emailRoutes);

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
        console.log("Available ports:", ports);

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

            // Arduino data handling section from server.js
            parser.on("data", async (rawData) => {
                try {
                    // Trim any whitespace and validate JSON format
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

                    // Create new sensor data entry with proper type conversion
                    const newEntry = new SensorData({
                        // Arduino sensor values
                        co: parseFloat(sensorData.co) || 0,
                        methane: parseFloat(sensorData.ch4) || 0,
                        airQuality: parseFloat(sensorData.air_quality) || 0,

                        // If Arduino calculates AQI, use it; otherwise it will be calculated
                        aqi: parseFloat(sensorData.aqi) || 0,

                        // Arduino might provide these; if not, they'll be filled by API later
                        temperature: parseFloat(sensorData.temperature) || 0,
                        humidity: parseFloat(sensorData.humidity) || 0,

                        // These are typically from API but Arduino might have them
                        pm25: parseFloat(sensorData.pm25) || 0,
                        pm10: parseFloat(sensorData.pm10) || 0,
                        o3: parseFloat(sensorData.o3) || 0,
                        so2: parseFloat(sensorData.so2) || 0,
                        no2: parseFloat(sensorData.no2) || 0,
                        nh3: parseFloat(sensorData.nh3) || 0,
                    });

                    await newEntry.save();
                    console.log("Saved Arduino data to DB:", newEntry);
                    checkAndSendAlerts();
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

// Set up alert check interval
setInterval(async () => {
    console.log("Running alert check...");
    try {
        const count = await checkAndSendAlerts();
        console.log(`Sent ${count || 0} notifications`);
    } catch (error) {
        console.error("Alert Check Error:", error);
    }
}, 15 * 60 * 1000);

const PORT = process.env.PORT || 5001; // Change to 5001 or any other available port
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));