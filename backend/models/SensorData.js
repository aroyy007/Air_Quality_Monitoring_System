import mongoose from "mongoose";

const sensorDataSchema = new mongoose.Schema(
  {
    aqi: Number,
    temperature: Number,
    humidity: Number,
    pm25: Number,
    pm10: Number,
    co: Number,
    methane: Number, // Added to match Arduino data
    airQuality: Number, // Added to match Arduino data
    o3: Number,
    so2: Number,
    no2: Number,
    nh3: Number,
  },
  { timestamps: true }
);

export default mongoose.model("SensorData", sensorDataSchema);