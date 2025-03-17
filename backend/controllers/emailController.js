// import EmailSubscription from "../models/EmailSubscription.js";
// import nodemailer from "nodemailer";
// import SensorData from "../models/SensorData.js";

// // Subscribe for email alerts
// export const subscribeEmail = async (req, res) => {
//     try {
//         const { email, threshold = 100 } = req.body;

//         // Validate email
//         if (!email) {
//             return res.status(400).json({ error: "Email is required" });
//         }

//         // Check if email already exists
//         const existingSubscription = await EmailSubscription.findOne({ email });

//         if (existingSubscription) {
//             // Update existing subscription
//             existingSubscription.threshold = threshold;
//             existingSubscription.active = true;
//             await existingSubscription.save();

//             return res.status(200).json({
//                 message: "Subscription updated successfully",
//                 subscription: existingSubscription
//             });
//         }

//         // Create new subscription
//         const newSubscription = new EmailSubscription({
//             email,
//             threshold
//         });

//         await newSubscription.save();

//         // Send confirmation email
//         await sendConfirmationEmail(email, threshold);

//         res.status(201).json({
//             message: "Subscription created successfully",
//             subscription: newSubscription
//         });
//     } catch (error) {
//         console.error("Email subscription error:", error);
//         res.status(500).json({
//             error: "Failed to subscribe",
//             details: error.message
//         });
//     }
// };

// // Unsubscribe from email alerts
// export const unsubscribeEmail = async (req, res) => {
//     try {
//         const { email } = req.body;

//         if (!email) {
//             return res.status(400).json({ error: "Email is required" });
//         }

//         const subscription = await EmailSubscription.findOne({ email });

//         if (!subscription) {
//             return res.status(404).json({ error: "Subscription not found" });
//         }

//         // Instead of deleting, just mark as inactive
//         subscription.active = false;
//         await subscription.save();

//         res.status(200).json({ message: "Unsubscribed successfully" });
//     } catch (error) {
//         console.error("Unsubscribe error:", error);
//         res.status(500).json({
//             error: "Failed to unsubscribe",
//             details: error.message
//         });
//     }
// };

// // Check and send alerts if needed (called by a scheduled job)
// export const checkAndSendAlerts = async () => {
//     try {
//         // Get the latest sensor data
//         const latestData = await SensorData.findOne().sort({ createdAt: -1 }).lean();

//         if (!latestData || !latestData.aqi) {
//             console.log("No sensor data available for alerts");
//             return;
//         }

//         const currentAQI = latestData.aqi;
//         console.log(`Current AQI: ${currentAQI}, checking for alert thresholds...`);

//         // Find all active subscriptions with thresholds exceeded
//         const timeBuffer = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
//         const sixHoursAgo = new Date(Date.now() - timeBuffer);

//         const subscriptionsToNotify = await EmailSubscription.find({
//             active: true,
//             threshold: { $lte: currentAQI },
//             $or: [
//                 { lastNotified: null },
//                 { lastNotified: { $lt: sixHoursAgo } }
//             ]
//         });

//         console.log(`Found ${subscriptionsToNotify.length} subscriptions to notify`);

//         // Send emails
//         for (const subscription of subscriptionsToNotify) {
//             await sendAlertEmail(subscription.email, currentAQI, subscription.threshold);

//             // Update lastNotified timestamp
//             subscription.lastNotified = new Date();
//             await subscription.save();
//         }

//         return subscriptionsToNotify.length;
//     } catch (error) {
//         console.error("Alert check error:", error);
//     }
// };

// // Helper function to send confirmation email
// const sendConfirmationEmail = async (email, threshold) => {
//     try {
//         const transporter = createTransporter();

//         await transporter.sendMail({
//             from: process.env.EMAIL_FROM || '"Air Quality Monitor" <noreply@airquality.example.com>',
//             to: email,
//             subject: "Air Quality Alert Subscription Confirmation",
//             html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
//           <h2>Subscription Confirmed</h2>
//           <p>Thank you for subscribing to Air Quality alerts. You will receive notifications when the AQI exceeds ${threshold}.</p>
//           <p>Current threshold: <strong>${threshold}</strong> (${getAQICategory(threshold)})</p>
//           <p>Stay healthy!</p>
//         </div>
//       `
//         });

//         console.log(`Confirmation email sent to ${email}`);
//     } catch (error) {
//         console.error("Error sending confirmation email:", error);
//     }
// };

// // Helper function to send alert email
// const sendAlertEmail = async (email, currentAQI, threshold) => {
//     try {
//         const transporter = createTransporter();

//         const category = getAQICategory(currentAQI);
//         const recommendations = getRecommendations(currentAQI);

//         await transporter.sendMail({
//             from: process.env.EMAIL_FROM || '"Air Quality Monitor" <noreply@airquality.example.com>',
//             to: email,
//             subject: `⚠️ ALERT: Air Quality Index Has Reached ${currentAQI}`,
//             html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
//           <h2 style="color: ${getColorForAQI(currentAQI)};">Air Quality Alert</h2>
//           <p>The Air Quality Index (AQI) in your area has reached <strong>${currentAQI}</strong>, which is considered <strong>${category}</strong>.</p>
//           <p>This exceeds your alert threshold of ${threshold}.</p>

//           <h3>Recommendations:</h3>
//           <ul>
//             ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
//           </ul>

//           <p>This is an automated alert from your Air Quality Monitoring System.</p>
//           <p style="font-size: 0.8em; color: #888;">To change your alert settings or unsubscribe, please visit the Air Quality Monitor dashboard.</p>
//         </div>
//       `
//         });

//         console.log(`Alert email sent to ${email} for AQI ${currentAQI}`);
//     } catch (error) {
//         console.error("Error sending alert email:", error);
//     }
// };

import EmailSubscription from "../models/EmailSubscription.js";
import nodemailer from "nodemailer";
import SensorData from "../models/SensorData.js";

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

        if (!latestData || !latestData.aqi) {
            console.log("No sensor data available for alerts");
            return;
        }

        const currentAQI = latestData.aqi;
        console.log(`Current AQI: ${currentAQI}, checking for alert thresholds...`);

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
        for (const subscription of subscriptionsToNotify) {
            await sendAlertEmail(subscription.email, currentAQI, subscription.threshold, subscription.healthConditions, latestData);

            // Update lastNotified timestamp
            subscription.lastNotified = new Date();
            await subscription.save();
        }

        return subscriptionsToNotify.length;
    } catch (error) {
        console.error("Alert check error:", error);
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
    } catch (error) {
        console.error("Error sending confirmation email:", error);
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
              <td style="border: 1px solid #ddd; padding: 8px;">${sensorData.temperature}°C</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">PM2.5</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${sensorData.pm25} µg/m³</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">PM10</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${sensorData.pm10} µg/m³</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Ozone (O₃)</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${sensorData.o3} ppb</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">Carbon Monoxide (CO)</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${sensorData.co} ppm</td>
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

        console.log(`Personalized alert email sent to ${email} for AQI ${currentAQI}`);
    } catch (error) {
        console.error("Error sending alert email:", error);
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

    // Asthma-specific recommendations
    if (healthConditions.hasAsthma) {
        // PM2.5 is particularly problematic for asthma
        if (sensorData.pm25 > 35 * severityMultiplier) {
            recommendations.push("For asthma: Consider staying indoors and having your inhaler readily available.");

            if (severity === "Moderate" || severity === "Severe") {
                recommendations.push("For asthma: Consider using air purifiers with HEPA filters indoors.");
            }
        }

        // Ozone can trigger asthma attacks
        if (sensorData.o3 > 50 * severityMultiplier) {
            recommendations.push("For asthma: Ozone levels are elevated, which may trigger symptoms. Limit outdoor activities.");

            if (severity === "Severe") {
                recommendations.push("For asthma: Consider wearing an N95 mask if you must go outdoors with these ozone levels.");
            }
        }

        // CO exposure considerations
        if (sensorData.co > 4 * severityMultiplier) {
            recommendations.push("For asthma: Current CO levels may aggravate respiratory issues. Avoid areas with vehicle exhaust or industrial emissions.");
        }
    }

    // Allergies-specific recommendations
    if (healthConditions.hasAllergies) {
        // PM10 often carries allergens
        if (sensorData.pm10 > 50 * severityMultiplier) {
            recommendations.push("For allergies: Current particulate matter levels may carry allergens. Consider taking your allergy medication.");

            if (severity === "Moderate" || severity === "Severe") {
                recommendations.push("For allergies: Keep windows closed and use air conditioning with clean filters.");
            }
        }

        // High humidity can promote mold growth, affecting allergies
        if (sensorData.humidity > 65) {
            recommendations.push("For allergies: High humidity levels may promote mold growth. Consider using a dehumidifier indoors.");
        }
    }

    // Respiratory conditions (like COPD)
    if (healthConditions.hasRespiratoryConditions || healthConditions.otherConditions?.toLowerCase().includes("copd") || healthConditions.otherConditions?.toLowerCase().includes("lung")) {
        // PM2.5 and PM10 are particularly dangerous
        if (sensorData.pm25 > 20 * severityMultiplier || sensorData.pm10 > 40 * severityMultiplier) {
            recommendations.push("For respiratory conditions: Current particulate levels are concerning. Stay indoors with windows closed.");

            if (severity === "Moderate" || severity === "Severe") {
                recommendations.push("For respiratory conditions: Consider using supplemental oxygen as prescribed by your doctor if symptoms worsen.");
            }
        }

        // CO is especially harmful to those with respiratory issues
        if (sensorData.co > 3 * severityMultiplier) {
            recommendations.push("For respiratory conditions: CO levels are elevated. Avoid outdoor activities and use air purifiers indoors.");
        }

        // NO2 and SO2 affect respiratory conditions
        if (sensorData.no2 > 40 * severityMultiplier || sensorData.so2 > 30 * severityMultiplier) {
            recommendations.push("For respiratory conditions: Nitrogen dioxide or sulfur dioxide levels are elevated, which may exacerbate breathing difficulties.");
        }
    }

    // Temperature considerations for all conditions
    if ((healthConditions.hasAsthma || healthConditions.hasRespiratoryConditions) && (sensorData.temperature > 30 || sensorData.temperature < 5)) {
        recommendations.push(`Extreme temperatures (currently ${sensorData.temperature}°C) can trigger respiratory symptoms. Maintain a comfortable indoor temperature.`);
    }

    // Add more specific considerations for other conditions
    if (healthConditions.otherConditions) {
        if (healthConditions.otherConditions.toLowerCase().includes("heart") ||
            healthConditions.otherConditions.toLowerCase().includes("cardio")) {
            recommendations.push("For cardiovascular conditions: Particulate pollution can affect heart health. Consider limiting physical exertion outdoors.");

            if (sensorData.aqi > 100) {
                recommendations.push("For heart conditions: These air quality levels are associated with increased risk of cardiovascular events. Monitor your symptoms closely.");
            }
        }
    }

    return recommendations;
};


// Create email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || "smtp.example.com",
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
            user: process.env.EMAIL_USER || "user@example.com",
            pass: process.env.EMAIL_PASSWORD || "password"
        }
    });
};
