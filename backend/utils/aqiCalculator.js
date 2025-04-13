// AQI calculation utility functions
// This file centralizes all AQI calculation functions to be used across the application

// Linear interpolation function for AQI calculation
export function linearScale(concentration, minConc, maxConc, minAQI, maxAQI) {
    return Math.round(
      ((maxAQI - minAQI) / (maxConc - minConc)) * (concentration - minConc) + minAQI
    );
  }
  
  // PM2.5 Index Calculation (μg/m³)
  export function calculatePM25Index(pm25) {
    if (pm25 <= 12.0) return linearScale(pm25, 0, 12.0, 0, 50);
    else if (pm25 <= 35.4) return linearScale(pm25, 12.1, 35.4, 51, 100);
    else if (pm25 <= 55.4) return linearScale(pm25, 35.5, 55.4, 101, 150);
    else if (pm25 <= 150.4) return linearScale(pm25, 55.5, 150.4, 151, 200);
    else if (pm25 <= 250.4) return linearScale(pm25, 150.5, 250.4, 201, 300);
    else if (pm25 <= 350.4) return linearScale(pm25, 250.5, 350.4, 301, 400);
    else return linearScale(pm25, 350.5, 500.4, 401, 500);
  }
  
  // PM10 Index Calculation (μg/m³)
  export function calculatePM10Index(pm10) {
    if (pm10 <= 54) return linearScale(pm10, 0, 54, 0, 50);
    else if (pm10 <= 154) return linearScale(pm10, 55, 154, 51, 100);
    else if (pm10 <= 254) return linearScale(pm10, 155, 254, 101, 150);
    else if (pm10 <= 354) return linearScale(pm10, 255, 354, 151, 200);
    else if (pm10 <= 424) return linearScale(pm10, 355, 424, 201, 300);
    else if (pm10 <= 504) return linearScale(pm10, 425, 504, 301, 400);
    else return linearScale(pm10, 505, 604, 401, 500);
  }
  
  // O3 Index Calculation (ppb)
  export function calculateO3Index(o3) {
    if (o3 <= 54) return linearScale(o3, 0, 54, 0, 50);
    else if (o3 <= 70) return linearScale(o3, 55, 70, 51, 100);
    else if (o3 <= 85) return linearScale(o3, 71, 85, 101, 150);
    else if (o3 <= 105) return linearScale(o3, 86, 105, 151, 200);
    else if (o3 <= 200) return linearScale(o3, 106, 200, 201, 300);
    else return linearScale(o3, 201, 504, 301, 500);
  }
  
  // CO Index Calculation (ppm) - ADJUSTED for more realistic thresholds
  export function calculateCOIndex(co) {
    // Adjusted EPA breakpoints for CO (ppm) to be more realistic for ambient air
    if (co <= 1.0) return linearScale(co, 0, 1.0, 0, 50);           // Good
    else if (co <= 2.0) return linearScale(co, 1.1, 2.0, 51, 100);  // Moderate
    else if (co <= 4.4) return linearScale(co, 2.1, 4.4, 101, 150); // Unhealthy for Sensitive Groups
    else if (co <= 9.4) return linearScale(co, 4.5, 9.4, 151, 200); // Unhealthy
    else if (co <= 12.4) return linearScale(co, 9.5, 12.4, 201, 300); // Very Unhealthy
    else return linearScale(co, 12.5, 15.4, 301, 500);              // Hazardous
  }
  
  // SO2 Index Calculation (ppb)
  export function calculateSO2Index(so2) {
    if (so2 <= 35) return linearScale(so2, 0, 35, 0, 50);
    else if (so2 <= 75) return linearScale(so2, 36, 75, 51, 100);
    else if (so2 <= 185) return linearScale(so2, 76, 185, 101, 150);
    else if (so2 <= 304) return linearScale(so2, 186, 304, 151, 200);
    else if (so2 <= 604) return linearScale(so2, 305, 604, 201, 300);
    else if (so2 <= 804) return linearScale(so2, 605, 804, 301, 400);
    else return linearScale(so2, 805, 1004, 401, 500);
  }
  
  // NO2 Index Calculation (ppb)
  export function calculateNO2Index(no2) {
    if (no2 <= 53) return linearScale(no2, 0, 53, 0, 50);
    else if (no2 <= 100) return linearScale(no2, 54, 100, 51, 100);
    else if (no2 <= 360) return linearScale(no2, 101, 360, 101, 150);
    else if (no2 <= 649) return linearScale(no2, 361, 649, 151, 200);
    else if (no2 <= 1249) return linearScale(no2, 650, 1249, 201, 300);
    else if (no2 <= 1649) return linearScale(no2, 1250, 1649, 301, 400);
    else return linearScale(no2, 1650, 2049, 401, 500);
  }
  
  // Calculate overall AQI based on all pollutants
  export function calculateAQI(pollutants) {
    // Log individual pollutant readings for debugging
    console.log("Calculating AQI for pollutants:", pollutants);
    
    const indices = [];
    const individualIndices = {};
    
    if (pollutants.pm25 !== undefined && pollutants.pm25 > 0) {
      const index = calculatePM25Index(pollutants.pm25);
      indices.push(index);
      individualIndices.pm25 = index;
    }
    
    if (pollutants.pm10 !== undefined && pollutants.pm10 > 0) {
      const index = calculatePM10Index(pollutants.pm10);
      indices.push(index);
      individualIndices.pm10 = index;
    }
    
    if (pollutants.o3 !== undefined && pollutants.o3 > 0) {
      const index = calculateO3Index(pollutants.o3);
      indices.push(index);
      individualIndices.o3 = index;
    }
    
    if (pollutants.co !== undefined && pollutants.co > 0) {
      const index = calculateCOIndex(pollutants.co);
      indices.push(index);
      individualIndices.co = index;
    }
    
    if (pollutants.so2 !== undefined && pollutants.so2 > 0) {
      const index = calculateSO2Index(pollutants.so2);
      indices.push(index);
      individualIndices.so2 = index;
    }
    
    if (pollutants.no2 !== undefined && pollutants.no2 > 0) {
      const index = calculateNO2Index(pollutants.no2);
      indices.push(index);
      individualIndices.no2 = index;
    }
    
    // Log individual indices for debugging
    console.log("Individual pollutant indices:", individualIndices);
    
    // AQI is the maximum of all pollutant indices
    const calculatedAQI = indices.length > 0 ? Math.max(...indices) : 0;
    
    // Log the final calculated AQI
    console.log("Final Calculated AQI:", calculatedAQI);
    
    return calculatedAQI;
  }