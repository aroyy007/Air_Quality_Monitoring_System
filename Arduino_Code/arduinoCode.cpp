#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C  // Change to 0x3D if needed

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Sensor Pins
const int MQ7_PIN = A0;    // CO Sensor
const int MQ135_PIN = A1;  // Air Quality Sensor
const int MQ4_PIN = A2;    // Methane Sensor

// Variables to store sensor readings
int mq7Value = 0;     
int mq135Value = 0;   
int mq4Value = 0;     
float co_ppm = 0;
float ch4_ppm = 0;
float air_quality_ppm = 0;

// Variables for displaying AQI (will be calculated on server)
int aqi = 0;
String airQualityMessage = "Calculating...";

// Sensor calibration values (adjust based on datasheet or calibration)
const float MQ7_RATIO_CLEAN_AIR = 9.83;
const float MQ135_RATIO_CLEAN_AIR = 3.6;
const float MQ4_RATIO_CLEAN_AIR = 4.4;

// Timing variables
unsigned long previousMillis = 0;
const long sensorReadInterval = 2000;      // Read sensors every 2 seconds
const long serialTransmitInterval = 5000;  // Send to PC every 5 seconds

void setup() {
  Serial.begin(9600);
  
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;);  // Loop forever if display fails
  }

  // Display startup message
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("Air Quality Monitor"));
  display.println(F("Starting sensors..."));
  display.println(F("Please wait..."));
  display.display();

  // Sensor warm-up period
  delay(30000);

  // Initial readings to stabilize
  for (int i = 0; i < 10; i++) {
    readSensors();
    delay(1000);
  }
}

void loop() {
  unsigned long currentMillis = millis();

  // Read sensor values at specified interval
  if (currentMillis - previousMillis >= sensorReadInterval) {
    previousMillis = currentMillis;
    
    readSensors();
    updateDisplay();

    // Send data to PC at specified interval
    if (currentMillis % serialTransmitInterval < sensorReadInterval) {
      sendDataToPC();
    }
  }

  // Check if there's data from the server (for AQI feedback)
  receiveFromServer();
}

// Function to read sensors
void readSensors() {
  // Read raw analog values
  mq7Value = analogRead(MQ7_PIN);
  mq135Value = analogRead(MQ135_PIN);
  mq4Value = analogRead(MQ4_PIN);
  
  // Convert to PPM using calibration curves
  co_ppm = calculatePPM(mq7Value, MQ7_RATIO_CLEAN_AIR, 100.0);
  air_quality_ppm = calculatePPM(mq135Value, MQ135_RATIO_CLEAN_AIR, 400.0);
  ch4_ppm = calculatePPM(mq4Value, MQ4_RATIO_CLEAN_AIR, 1000.0);
}

// Function to calculate PPM values
float calculatePPM(int sensorValue, float ratioCleanAir, float baselinePPM) {
  float voltage = sensorValue * (5.0 / 1023.0);
  float rs = ((5.0 * 10.0) / voltage) - 10.0; // Assuming 10K load resistor
  return baselinePPM * pow(rs / ratioCleanAir, -1.2);
}

void updateDisplay() {
  display.clearDisplay();
  
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(F("AQI: "));
  display.setTextSize(2);
  display.setCursor(0, 10);
  display.print(aqi);
  
  display.setTextSize(1);
  display.setCursor(0, 28);
  display.println(airQualityMessage);

  display.setCursor(0, 38);
  display.print(F("CO: "));
  display.print(co_ppm, 1);
  display.println(F(" ppm"));

  display.setCursor(0, 48);
  display.print(F("CH4: "));
  display.print(ch4_ppm, 1);
  display.println(F(" ppm"));

  display.setCursor(0, 58);
  display.print(F("AQ: "));
  display.print(air_quality_ppm, 1);
  display.println(F(" ppm"));

  display.display();
}

// Function to send data to PC/server
void sendDataToPC() {
  // Send all sensor readings in JSON format
  Serial.print(F("{\"co\":"));
  Serial.print(co_ppm, 1);
  Serial.print(F(",\"methane\":"));  // Match the field name in SensorData.js
  Serial.print(ch4_ppm, 1);
  Serial.print(F(",\"airQuality\":"));  // Match the field name in SensorData.js
  Serial.print(air_quality_ppm, 1);
  
  // Include estimation for PM2.5 and PM10 based on MQ135 readings if possible
  // These are rough estimations and should be replaced with actual PM sensor data
  float estimated_pm25 = air_quality_ppm * 0.3;  // Very rough estimate
  float estimated_pm10 = air_quality_ppm * 0.5;  // Very rough estimate
  
  Serial.print(F(",\"pm25\":"));
  Serial.print(estimated_pm25, 1);
  Serial.print(F(",\"pm10\":"));
  Serial.print(estimated_pm10, 1);
  
  // You can add additional sensor data here as needed
  
  Serial.println(F("}"));
}

// Function to receive and parse data from server
void receiveFromServer() {
  if (Serial.available() > 0) {
    String data = Serial.readStringUntil('\n');
    
    // Basic parsing of JSON-like response from server
    // Format expected: {"aqi":120,"status":"Unhealthy for Sensitive Groups"}
    if (data.startsWith("{") && data.indexOf("aqi") > 0) {
      int aqiStart = data.indexOf("aqi") + 5;  // Position after "aqi":"
      int aqiEnd = data.indexOf(",", aqiStart);
      if (aqiEnd < 0) aqiEnd = data.indexOf("}", aqiStart);
      
      String aqiStr = data.substring(aqiStart, aqiEnd);
      aqi = aqiStr.toInt();
      
      // Extract status message if present
      int statusStart = data.indexOf("status") + 9;  // Position after "status":"
      if (statusStart > 9) {  // Found "status":
        int statusEnd = data.indexOf("\"", statusStart);
        if (statusEnd > statusStart) {
          airQualityMessage = data.substring(statusStart, statusEnd);
        }
      }
    }
  }
}