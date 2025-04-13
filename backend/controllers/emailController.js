import EmailSubscription from "../models/EmailSubscription.js";
import nodemailer from "nodemailer";
import SensorData from "../models/SensorData.js";

// Function to determine AQI category based on value
const getAQICategory = (aqi) => {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Moderate";
    if (aqi <= 150) return "Unhealthy for Sensitive Groups";
    if (aqi <= 200) return "Unhealthy";
    if (aqi <= 300) return "Very Unhealthy";
    return "Hazardous";
};

// Function to get color for AQI value
const getColorForAQI = (aqi) => {
    if (aqi <= 50) return "#00e400"; // Green
    if (aqi <= 100) return "#ffff00"; // Yellow
    if (aqi <= 150) return "#ff7e00"; // Orange
    if (aqi <= 200) return "#ff0000"; // Red
    if (aqi <= 300) return "#8f3f97"; // Purple
    return "#7e0023"; // Maroon
};

// Get recommendations based on AQI level
const getRecommendations = (aqi) => {
    const recommendations = [];

    if (aqi <= 50) {
        recommendations.push("Air quality is good. Enjoy outdoor activities.");
        recommendations.push("No special precautions needed.");
    } else if (aqi <= 100) {
        recommendations.push("Unusually sensitive individuals should consider reducing prolonged outdoor exertion.");
        recommendations.push("It's a good idea to close windows during periods of high outdoor pollution.");
    } else if (aqi <= 150) {
        recommendations.push("People with respiratory or heart disease, the elderly and children should limit prolonged outdoor exertion.");
        recommendations.push("Consider wearing a mask outdoors if you have respiratory conditions.");
        recommendations.push("Run an air purifier in your home if available.");
    } else if (aqi <= 200) {
        recommendations.push("Everyone should limit prolonged outdoor exertion.");
        recommendations.push("Run an air purifier indoors and keep windows closed.");
        recommendations.push("Wear N95 masks outdoors if you must go outside.");
    } else if (aqi <= 300) {
        recommendations.push("Everyone should avoid outdoor activities.");
        recommendations.push("Stay indoors with windows and doors closed.");
        recommendations.push("Use air conditioning with a clean filter if available.");
        recommendations.push("Consider relocating temporarily if air quality remains poor.");
    } else {
        recommendations.push("HEALTH ALERT: Everyone should avoid all outdoor physical activities.");
        recommendations.push("Remain indoors with air purifiers running if available.");
        recommendations.push("Wear N95 or better masks if you absolutely must go outside.");
        recommendations.push("Consider evacuation if air quality remains at hazardous levels.");
    }

    return recommendations;
};

// Subscribe for email alerts
export const subscribeEmail = async (req, res) => {
    try {
        const { email, threshold = 100, healthConditions = {} } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        // Check if email already exists
        const existingSubscription = await EmailSubscription.findOne({ email });

        if (existingSubscription) {
            // Update existing subscription
            existingSubscription.threshold = threshold;
            existingSubscription.healthConditions = healthConditions;
            existingSubscription.active = true;
            await existingSubscription.save();

            return res.status(200).json({
                message: "Subscription updated successfully",
                subscription: existingSubscription
            });
        }

        // Create new subscription
        const newSubscription = new EmailSubscription({
            email,
            threshold,
            healthConditions
        });

        await newSubscription.save();

        // Send confirmation email
        await sendConfirmationEmail(email, threshold, healthConditions);

        res.status(201).json({
            message: "Subscription created successfully",
            subscription: newSubscription
        });
    } catch (error) {
        console.error("Email subscription error:", error);
        res.status(500).json({
            error: "Failed to subscribe",
            details: error.message
        });
    }
};

// Unsubscribe from email alerts
export const unsubscribeEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        const subscription = await EmailSubscription.findOne({ email });

        if (!subscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }

        // Instead of deleting, just mark as inactive
        subscription.active = false;
        await subscription.save();

        res.status(200).json({ message: "Unsubscribed successfully" });
    } catch (error) {
        console.error("Unsubscribe error:", error);
        res.status(500).json({
            error: "Failed to unsubscribe",
            details: error.message
        });
    }
};

// Check and send alerts if needed (called by a scheduled job)
export const checkAndSendAlerts = async () => {
    try {
        // Get the latest sensor data
        const latestData = await SensorData.findOne().sort({ createdAt: -1 }).lean();

        if (!latestData) {
            console.log("No sensor data available for alerts");
            return 0;
        }

        // Ensure AQI exists and is a number
        const currentAQI = parseFloat(latestData.aqi) || 0;
        console.log(`Current AQI: ${currentAQI}, checking for alert thresholds...`);

        if (currentAQI <= 0) {
            console.log("Invalid AQI value, skipping alerts");
            return 0;
        }

        // Find all active subscriptions with thresholds exceeded
        const timeBuffer = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        const sixHoursAgo = new Date(Date.now() - timeBuffer);

        const subscriptionsToNotify = await EmailSubscription.find({
            active: true,
            threshold: { $lte: currentAQI },
            $or: [
                { lastNotified: null },
                { lastNotified: { $lt: sixHoursAgo } }
            ]
        });

        console.log(`Found ${subscriptionsToNotify.length} subscriptions to notify`);

        // Send emails
        let sentCount = 0;
        for (const subscription of subscriptionsToNotify) {
            try {
                await sendAlertEmail(subscription.email, currentAQI, subscription.threshold, subscription.healthConditions, latestData);
                sentCount++;

                // Update lastNotified timestamp
                subscription.lastNotified = new Date();
                await subscription.save();
            } catch (emailError) {
                console.error(`Failed to send alert to ${subscription.email}:`, emailError);
            }
        }

        console.log(`Successfully sent ${sentCount} alert emails`);
        return sentCount;
    } catch (error) {
        console.error("Alert check error:", error);
        return 0;
    }
};

// Helper function to send confirmation email
const sendConfirmationEmail = async (email, threshold, healthConditions) => {
    try {
        const transporter = createTransporter();

        // Generate health condition summary
        let healthSummary = "";
        if (healthConditions) {
            const conditions = [];
            if (healthConditions.hasAsthma) conditions.push("Asthma");
            if (healthConditions.hasAllergies) conditions.push("Allergies");
            if (healthConditions.hasRespiratoryConditions) conditions.push("Respiratory conditions");
            if (healthConditions.otherConditions) conditions.push(healthConditions.otherConditions);

            if (conditions.length > 0) {
                healthSummary = `
                <div style="margin-top: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                    <p><strong>Health Profile:</strong> ${conditions.join(", ")}</p>
                    ${healthConditions.conditionSeverity !== "None" ?
                        `<p><strong>Severity:</strong> ${healthConditions.conditionSeverity}</p>` : ''}
                    <p>Your alerts will be personalized based on these health conditions.</p>
                </div>`;
            }
        }

        // Test the email configuration by logging
        console.log("Sending confirmation email with transporter:", {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === "true",
            user: process.env.EMAIL_USER
        });

        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Air Quality Monitor" <noreply@airquality.example.com>',
            to: email,
            subject: "Air Quality Alert Subscription Confirmation",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2>Subscription Confirmed</h2>
          <p>Thank you for subscribing to Air Quality alerts. You will receive personalized notifications when the AQI exceeds ${threshold}.</p>
          <p>Current threshold: <strong>${threshold}</strong> (${getAQICategory(threshold)})</p>
          ${healthSummary}
          <p>Stay healthy!</p>
        </div>
      `
        });

        console.log(`Confirmation email sent to ${email}`);
        return true;
    } catch (error) {
        console.error("Error sending confirmation email:", error);
        throw error; // Rethrow to handle in the caller
    }
};

// Helper function to send alert email
const sendAlertEmail = async (email, currentAQI, threshold, healthConditions, sensorData) => {
    try {
        const transporter = createTransporter();

        const category = getAQICategory(currentAQI);

        // Get personalized recommendations based on health conditions and sensor data
        const personalizedRecommendations = getPersonalizedRecommendations(healthConditions, sensorData);
        const generalRecommendations = getRecommendations(currentAQI);

        // Combine recommendations, with personalized ones first
        const allRecommendations = [...personalizedRecommendations, ...generalRecommendations];

        // Remove duplicates
        const uniqueRecommendations = [...new Set(allRecommendations)];

        // Format numbers to avoid NaN or undefined
        const formattedData = {
            temperature: (sensorData.temperature || 0).toFixed(1),
            pm25: (sensorData.pm25 || 0).toFixed(1),
            pm10: (sensorData.pm10 || 0).toFixed(1),
            o3: (sensorData.o3 || 0).toFixed(1),
            co: (sensorData.co || 0).toFixed(2)
        };

        console.log(`Sending alert email to ${email} for AQI ${currentAQI}`);

        await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Air Quality Monitor" <noreply@airquality.example.com>',
            to: email,
            subject: `⚠️ ALERT: Air Quality Index Has Reached ${currentAQI}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: ${getColorForAQI(currentAQI)};">Air Quality Alert</h2>
          <p>The Air Quality Index (AQI) in your area has reached <strong>${currentAQI}</strong>, which is considered <strong>${category}</strong>.</p>
          <p>This exceeds your alert threshold of ${threshold}.</p>
          
          <h3>Current Readings:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Pollutant</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Value</th>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Temperature</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formattedData.temperature}°C</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">PM2.5</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formattedData.pm25} µg/m³</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">PM10</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formattedData.pm10} µg/m³</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Ozone (O₃)</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formattedData.o3} ppb</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Carbon Monoxide (CO)</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${formattedData.co} ppm</td>
            </tr>
          </table>
          
          <h3>Personalized Recommendations:</h3>
          <ul>
            ${uniqueRecommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
          
          <p>This is an automated alert from your Air Quality Monitoring System.</p>
          <p style="font-size: 0.8em; color: #888;">To change your alert settings or unsubscribe, please visit the Air Quality Monitor dashboard.</p>
        </div>
      `
        });

        console.log(`Alert email sent successfully to ${email}`);
        return true;
    } catch (error) {
        console.error(`Error sending alert email to ${email}:`, error);
        throw error; // Rethrow to handle in the caller
    }
};

// Function to get personalized recommendations based on health conditions and sensor data
const getPersonalizedRecommendations = (healthConditions, sensorData) => {
    const recommendations = [];

    if (!healthConditions) return recommendations;

    const severity = healthConditions.conditionSeverity || "None";
    const severityMultiplier =
        severity === "Severe" ? 0.7 :
            severity === "Moderate" ? 0.8 :
                severity === "Mild" ? 0.9 : 1.0;

    // Safe default values for sensor data
    const safeData = {
        pm25: parseFloat(sensorData?.pm25) || 0,
        pm10: parseFloat(sensorData?.pm10) || 0,
        o3: parseFloat(sensorData?.o3) || 0,
        co: parseFloat(sensorData?.co) || 0,
        no2: parseFloat(sensorData?.no2) || 0,
        so2: parseFloat(sensorData?.so2) || 0,
        humidity: parseFloat(sensorData?.humidity) || 0,
        temperature: parseFloat(sensorData?.temperature) || 0,
        aqi: parseFloat(sensorData?.aqi) || 0
    };

    // Asthma-specific recommendations
    if (healthConditions.hasAsthma) {
        // PM2.5 is particularly problematic for asthma
        if (safeData.pm25 > 35 * severityMultiplier) {
            recommendations.push("For asthma: Consider staying indoors and having your inhaler readily available.");

            if (severity === "Moderate" || severity === "Severe") {
                recommendations.push("For asthma: Consider using air purifiers with HEPA filters indoors.");
            }
        }

        // Ozone can trigger asthma attacks
        if (safeData.o3 > 50 * severityMultiplier) {
            recommendations.push("For asthma: Ozone levels are elevated, which may trigger symptoms. Limit outdoor activities.");

            if (severity === "Severe") {
                recommendations.push("For asthma: Consider wearing an N95 mask if you must go outdoors with these ozone levels.");
            }
        }

        // CO exposure considerations
        if (safeData.co > 4 * severityMultiplier) {
            recommendations.push("For asthma: Current CO levels may aggravate respiratory issues. Avoid areas with vehicle exhaust or industrial emissions.");
        }
    }

    // Allergies-specific recommendations
    if (healthConditions.hasAllergies) {
        // PM10 often carries allergens
        if (safeData.pm10 > 50 * severityMultiplier) {
            recommendations.push("For allergies: Current particulate matter levels may carry allergens. Consider taking your allergy medication.");

            if (severity === "Moderate" || severity === "Severe") {
                recommendations.push("For allergies: Keep windows closed and use air conditioning with clean filters.");
            }
        }

        // High humidity can promote mold growth, affecting allergies
        if (safeData.humidity > 65) {
            recommendations.push("For allergies: High humidity levels may promote mold growth. Consider using a dehumidifier indoors.");
        }
    }

    // Respiratory conditions (like COPD)
    if (healthConditions.hasRespiratoryConditions ||
        (healthConditions.otherConditions &&
            (healthConditions.otherConditions.toLowerCase().includes("copd") ||
                healthConditions.otherConditions.toLowerCase().includes("lung")))) {
        // PM2.5 and PM10 are particularly dangerous
        if (safeData.pm25 > 20 * severityMultiplier || safeData.pm10 > 40 * severityMultiplier) {
            recommendations.push("For respiratory conditions: Current particulate levels are concerning. Stay indoors with windows closed.");

            if (severity === "Moderate" || severity === "Severe") {
                recommendations.push("For respiratory conditions: Consider using supplemental oxygen as prescribed by your doctor if symptoms worsen.");
            }
        }

        // CO is especially harmful to those with respiratory issues
        if (safeData.co > 3 * severityMultiplier) {
            recommendations.push("For respiratory conditions: CO levels are elevated. Avoid outdoor activities and use air purifiers indoors.");
        }

        // NO2 and SO2 affect respiratory conditions
        if (safeData.no2 > 40 * severityMultiplier || safeData.so2 > 30 * severityMultiplier) {
            recommendations.push("For respiratory conditions: Nitrogen dioxide or sulfur dioxide levels are elevated, which may exacerbate breathing difficulties.");
        }
    }

    // Temperature considerations for all conditions
    if ((healthConditions.hasAsthma || healthConditions.hasRespiratoryConditions) &&
        (safeData.temperature > 30 || safeData.temperature < 5)) {
        recommendations.push(`Extreme temperatures (currently ${safeData.temperature.toFixed(1)}°C) can trigger respiratory symptoms. Maintain a comfortable indoor temperature.`);
    }

    // Add more specific considerations for other conditions
    if (healthConditions.otherConditions) {
        if (healthConditions.otherConditions.toLowerCase().includes("heart") ||
            healthConditions.otherConditions.toLowerCase().includes("cardio")) {
            recommendations.push("For cardiovascular conditions: Particulate pollution can affect heart health. Consider limiting physical exertion outdoors.");

            if (safeData.aqi > 100) {
                recommendations.push("For heart conditions: These air quality levels are associated with increased risk of cardiovascular events. Monitor your symptoms closely.");
            }
        }
    }

    return recommendations;
};

// Create email transporter
const createTransporter = () => {
    // Log email configuration for debugging
    console.log("Creating email transporter with:", {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === "true"
    });

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: parseInt(process.env.EMAIL_PORT || "587"),
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
            user: process.env.EMAIL_USER || "user@example.com",
            pass: process.env.EMAIL_PASSWORD || "password"
        },
        tls: {
            rejectUnauthorized: false // This can help with some self-signed certificates
        }
    });
};

// Manually trigger alerts (for testing purposes)
export const triggerManualAlert = async (req, res) => {
    try {
        const result = await checkAndSendAlerts();
        res.status(200).json({
            message: `Manual alert check completed. Sent ${result} notifications.`
        });
    } catch (error) {
        console.error("Manual alert trigger error:", error);
        res.status(500).json({
            error: "Failed to trigger alerts",
            details: error.message
        });
    }
};