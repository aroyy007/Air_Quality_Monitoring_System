import express from "express";
import { subscribeEmail, unsubscribeEmail, triggerManualAlert } from "../controllers/emailController.js";

const router = express.Router();

router.post("/subscribe", subscribeEmail);
router.post("/unsubscribe", unsubscribeEmail);
router.get("/test-alert", triggerManualAlert); // Add this new endpoint for testing

export default router;