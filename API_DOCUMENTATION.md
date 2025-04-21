# 🌫️ API Documentation

## 📌 Overview

This RESTful API allows clients to interact with a real-time Air Quality Monitoring System. It supports sensor data ingestion (from Arduino), weather integration (via OpenWeatherMap API), email alerts for AQI thresholds, and AQI prediction using historical data.

---

## 🔗 Base URL

```
http://localhost:5001
```

---

## 📂 API Endpoints

### 1. 📡 Sensor Data

---

#### `POST /api/sensors/upload`

Uploads sensor readings (CO, Methane, General AQ) from Arduino or other sources.

**Request Body (JSON):**

```json
{
  "co": 0.35,
  "methane": 2.15,
  "airQuality": 450,
  "pm25": 78,
  "pm10": 100,
  "temperature": 30.5,
  "humidity": 65
}
```

**Response (201 Created):**

```json
{
  "message": "Sensor data uploaded successfully",
  "data": {
    "id": "661c305ce9e9a43e5c3709ab",
    "timestamp": "2025-04-14T12:45:30.000Z",
    "co": 0.35,
    "methane": 2.15,
    "airQuality": 450,
    "aqi": 134
  }
}
```

---

#### `GET /api/sensors/latest`

Fetches the most recent air quality data entry.

**Response (200 OK):**

```json
{
  "timestamp": "2025-04-14T12:45:30.000Z",
  "co": 0.35,
  "methane": 2.15,
  "airQuality": 450,
  "pm25": 78,
  "pm10": 100,
  "temperature": 30.5,
  "humidity": 65,
  "aqi": 134
}
```

---

### 2. ☀️ Weather Data

---

#### `GET /api/weather`

Fetches current weather and air quality metrics from OpenWeatherMap.

**Response (200 OK):**

```json
{
  "temperature": 30.5,
  "humidity": 65,
  "pm25": 78,
  "pm10": 100,
  "o3": 45,
  "so2": 20,
  "no2": 35,
  "nh3": 18
}
```

---

#### `GET /api/weather/historical`

Fetches the last 30 days of historical air quality and weather data.

**Response (200 OK):**

```json
[
  {
    "date": "2025-04-01",
    "pm25": 85,
    "pm10": 110,
    "aqi": 142
  },
  {
    "date": "2025-04-02",
    "pm25": 77,
    "pm10": 95,
    "aqi": 128
  }
]
```

---

### 3. 📧 Email Alerts

---

#### `POST /api/alerts/subscribe`

Subscribes a user to AQI alerts.

**Request Body (JSON):**

```json
{
  "email": "example@gmail.com",
  "aqiThreshold": 150
}
```

**Response (201 Created):**

```json
{
  "message": "Subscription successful. You will be alerted when AQI exceeds 150."
}
```

---

#### `POST /api/alerts/unsubscribe`

Unsubscribes a user from AQI alerts.

**Request Body (JSON):**

```json
{
  "email": "example@gmail.com"
}
```

**Response (200 OK):**

```json
{
  "message": "Successfully unsubscribed from alerts."
}
```

---

#### `GET /api/alerts/test-alert`

Sends a test alert email to verify that the notification system works.

**Response (200 OK):**

```json
{
  "message": "Test alert email sent."
}
```

---

### 4. 📈 Predictions

---

#### `GET /api/predictions`

Fetches predicted AQI values for the next 24 hours using a HuggingFace transformer model (planned feature).

**Response (200 OK):**

```json
[
  { "time": "2025-04-15T01:00:00Z", "predictedAQI": 112 },
  { "time": "2025-04-15T02:00:00Z", "predictedAQI": 118 },
  ...
]
```

---

## ⚠️ Error Handling

API responses include appropriate HTTP status codes and error messages.

| Code | Description                  | Example Message                            |
|------|------------------------------|---------------------------------------------|
| 400  | Bad Request                  | "Invalid input data."                      |
| 401  | Unauthorized                 | "Missing or invalid API key."              |
| 404  | Not Found                    | "Resource not found."                      |
| 500  | Internal Server Error        | "Something went wrong on the server."      |

**Example error response:**

```json
{
  "error": "Invalid email address"
}
```

---

## 🧪 Environment Variables

The backend requires the following `.env` configuration:

```env
PORT=5001
MONGODB_URI=mongodb+srv://your_mongodb_uri
OPENWEATHERMAP_API_KEY=your_openweather_api_key
CITY_NAME=Chittagong,BD
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
```

---

## 🧾 Data Models

### Sensor Data

```js
{
  co: Number,
  methane: Number,
  airQuality: Number,
  temperature: Number,
  humidity: Number,
  pm25: Number,
  pm10: Number,
  o3: Number,
  so2: Number,
  no2: Number,
  nh3: Number,
  aqi: Number,
  timestamp: Date
}
```

### Email Subscription

```js
{
  email: String,
  aqiThreshold: Number,
  subscribedAt: Date
}
```

---

## 📝 Notes

- The server polls air quality data and checks alerts every **2 minutes**.
- Alerts are sent automatically if AQI exceeds a user's threshold.
- Historical prediction support will use a trained time-series transformer model for AQI forecasting.
