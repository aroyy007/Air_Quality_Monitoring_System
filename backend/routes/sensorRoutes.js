import express from "express";
import { saveSensorData, getSensorData } from "../controllers/sensorController.js";

const router = express.Router();

router.post("/upload", saveSensorData);
router.get("/latest", getSensorData);

export default router;
