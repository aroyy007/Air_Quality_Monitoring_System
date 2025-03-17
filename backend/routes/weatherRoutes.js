import express from "express";
import { getWeatherData, getHistoricalData } from "../controllers/weatherController.js";

const router = express.Router();

router.get("/", getWeatherData);
router.get("/historical", getHistoricalData);

export default router;