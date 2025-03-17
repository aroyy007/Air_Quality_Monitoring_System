#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Sensor Pins
const int MQ7_PIN = A0;  // CO Sensor
const int MQ135_PIN = A1;  // Air Quality Sensor
const int MQ4_PIN = A2;  // Methane Sensor

// Variables to store sensor readings
int mq7Value = 0;     // CO
int mq135Value = 0;   // Air Quality
int mq4Value = 0;     // Methane (CH4)
float co_ppm = 0;
float ch4_ppm = 0;
float air_quality_ppm = 0;

// Variables for AQI calculation
int aqi = 0;
String airQualityMessage = "";

// Sensor calibration values - adjust these based on your sensor calibration
const float MQ7_RATIO_CLEAN_AIR = 9.83;  // RS/R0 value in clean air for MQ7
const float MQ135_RATIO_CLEAN_AIR = 3.6;  // RS/R0 value in clean air for MQ135
const float MQ4_RATIO_CLEAN_AIR = 4.4;    // RS/R0 value in clean air for MQ4

// Timing variables
unsigned long previousMillis = 0;
const long sensorReadInterval = 2000;      // Read sensors every 2 seconds
const long serialTransmitInterval = 5000;  // Send to PC every 5 seconds

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Initialize the OLED display
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;); // Don't proceed, loop forever
  }
  
  // Clear the display buffer
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Display startup message
  display.setCursor(0, 0);
  display.println(F("Air Quality Monitor"));
  display.println(F("Starting sensors..."));
  display.println(F("Please wait..."));
  display.display();
  
  // Warm-up period for the sensors
  delay(30000);  // 30 seconds warm-up
  
  // Initial readings to stabilize
  for (int i = 0; i < 10; i++) {
    readSensors();
    delay(1000);
  }
  
  Serial.println(F("Air Quality Monitor Ready"));
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Read sensor values at specified interval
  if (currentMillis - previousMillis >= sensorReadInterval) {
    previousMillis = currentMillis;
    
    // Read and calculate sensor values
    readSensors();
    calculateAQI();
    
    // Update display
    updateDisplay();
    
    // Send data to PC at specified interval
    if (currentMillis % serialTransmitInterval < sensorReadInterval) {
      sendDataToPC();
    }
  }
}

void readSensors() {
  // Read analog values from sensors
  mq7Value = analogRead(MQ7_PIN);
  mq135Value = analogRead(MQ135_PIN);
  mq4Value = analogRead(MQ4_PIN);
  
  // Convert analog values to PPM (simplified calculation - calibrate as needed)
  co_ppm = calculatePPM(mq7Value, MQ7_RATIO_CLEAN_AIR, 100.0);
  air_quality_ppm = calculatePPM(mq135Value, MQ135_RATIO_CLEAN_AIR, 400.0);
  ch4_ppm = calculatePPM(mq4Value, MQ4_RATIO_CLEAN_AIR, 1000.0);
}

float calculatePPM(int sensorValue, float ratioCleanAir, float baselinePPM) {
  // This is a simplified calculation and should be calibrated for each sensor
  // Using the formula: PPM = K * (Rs/R0)^-b where K and b are constants from datasheet
  float sensorResistance = 1023.0 / sensorValue - 1.0;
  // Simple power law model (adjust exponent based on sensor curves)
  return baselinePPM * pow(sensorResistance / ratioCleanAir, -1.2);
}

void calculateAQI() {
  // Simplified AQI calculation based on sensor readings
  // In a real system, you would use proper EPA or similar conversion formulas
  // This is just a demonstration
  
  // Using MQ135 as primary AQI indicator (simplified)
  if (air_quality_ppm < 50) {
    aqi = map(air_quality_ppm, 0, 50, 0, 50);
    airQualityMessage = "Good";
  } else if (air_quality_ppm < 100) {
    aqi = map(air_quality_ppm, 50, 100, 51, 100);
    airQualityMessage = "Moderate";
  } else if (air_quality_ppm < 150) {
    aqi = map(air_quality_ppm, 100, 150, 101, 150);
    airQualityMessage = "Unhealthy (Sensitive)";
  } else if (air_quality_ppm < 200) {
    aqi = map(air_quality_ppm, 150, 200, 151, 200);
    airQualityMessage = "Unhealthy";
  } else if (air_quality_ppm < 300) {
    aqi = map(air_quality_ppm, 200, 300, 201, 300);
    airQualityMessage = "Very Unhealthy";
  } else {
    aqi = map(air_quality_ppm, 300, 500, 301, 500);
    airQualityMessage = "Hazardous!";
  }
  
  // CO adjustment (if CO is high, increase AQI)
  if (co_ppm > 9) {
    aqi += 50;
    if (airQualityMessage.indexOf("Hazardous") == -1) {
      airQualityMessage = "Hazardous! High CO";
    }
  }
  
  // Methane adjustment (if CH4 is high, increase AQI)
  if (ch4_ppm > 5000) {
    aqi += 20;
    if (airQualityMessage.indexOf("Hazardous") == -1) {
      airQualityMessage = "Warning! High CH4";
    }
  }
  
  // Cap AQI at 500 (max value on standard scale)
  if (aqi > 500) aqi = 500;
}

void updateDisplay() {
  display.clearDisplay();
  
  // Show AQI
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("Air Quality Index:"));
  display.setTextSize(2);
  display.setCursor(0, 10);
  display.print(aqi);
  
  // Show AQI status message
  display.setTextSize(1);
  display.setCursor(0, 28);
  display.println(airQualityMessage);
  
  // Display sensor readings
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

void sendDataToPC() {
  // Format data as JSON for easy parsing by your website backend
  Serial.print(F("{\"co\":"));
  Serial.print(co_ppm, 1);
  Serial.print(F(",\"ch4\":"));
  Serial.print(ch4_ppm, 1);
  Serial.print(F(",\"air_quality\":"));
  Serial.print(air_quality_ppm, 1);
  Serial.print(F(",\"aqi\":"));
  Serial.print(aqi);
  Serial.print(F(",\"status\":\""));
  Serial.print(airQualityMessage);
  Serial.println(F("\"}"));
}
