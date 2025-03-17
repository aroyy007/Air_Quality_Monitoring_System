import express from "express";
import { subscribeEmail, unsubscribeEmail } from "../controllers/emailController.js";

const router = express.Router();

router.post("/subscribe", subscribeEmail);
router.post("/unsubscribe", unsubscribeEmail);

export default router;