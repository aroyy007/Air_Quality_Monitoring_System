import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Hourglass } from "lucide-react";

interface PredictionData {
    hour: number;
    aqi: number;
}

const AQIPredictionChart = () => {
    const [predictions, setPredictions] = useState<PredictionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPredictions = async () => {
            try {
                setLoading(true);
                // First try the original API endpoint
                const response = await fetch("http://localhost:5000/api/predictions")
                    .catch(err => {
                        console.error("Initial fetch failed:", err);
                        // Try alternative endpoint as fallback
                        return fetch("http://localhost:5000/predictions");
                    });

                if (!response.ok) {
                    console.error(`Server responded with status: ${response.status}`);
                    // If we have a response but it's not OK, try to read the error
                    const errorText = await response.text();
                    throw new Error(`Server error (${response.status}): ${errorText}`);
                }

                const data = await response.json();
                console.log("Received prediction data:", data);

                // Check if we have the expected data structure
                if (!data.predictions || !Array.isArray(data.predictions)) {
                    console.error("Unexpected data format:", data);
                    throw new Error("Invalid data format received from server");
                }

                // Format the prediction data for charting
                const formattedData = data.predictions.map((prediction: any, index: number) => ({
                    hour: index + 1,
                    aqi: Math.round(prediction.aqi || 0),
                }));

                setPredictions(formattedData);
                setError(null);
            } catch (error) {
                console.error("Failed to fetch predictions:", error);
                
                // Generate mock data for demonstration
                if (process.env.NODE_ENV !== 'production') {
                    console.log("Using mock data for development");
                    const mockData = Array.from({ length: 24 }, (_, i) => ({
                        hour: i + 1,
                        aqi: Math.round(50 + Math.random() * 50),
                    }));
                    setPredictions(mockData);
                    setError("Using sample data (API unavailable)");
                } else {
                    setError("Failed to load predictions. Please try again later.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchPredictions();
    }, []);

    // Determine AQI color
    const getAQIColor = (aqi: number) => {
        if (aqi <= 50) return "#00e400"; // Good
        if (aqi <= 100) return "#ffff00"; // Moderate
        if (aqi <= 150) return "#ff7e00"; // Unhealthy for Sensitive Groups
        if (aqi <= 200) return "#ff0000"; // Unhealthy
        if (aqi <= 300) return "#8f3f97"; // Very Unhealthy
        return "#7e0023"; // Hazardous
    };

    // Get tomorrow's AQI forecast
    const getTomorrowAQI = () => {
        if (predictions.length === 0) return 0;

        // Calculate average AQI for the first 24 hours (tomorrow)
        const tomorrowHours = predictions.slice(0, 24);
        const sum = tomorrowHours.reduce((acc, curr) => acc + curr.aqi, 0);
        return Math.round(sum / tomorrowHours.length);
    };

    const tomorrowAQI = getTomorrowAQI();
    const tomorrowAQIColor = getAQIColor(tomorrowAQI);

    return (
        <Card className="glass-panel col-span-full">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                    <Hourglass className="mr-2" />
                    AQI Prediction (Next 24 Hours)
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading && <p className="text-center py-4">Loading predictions...</p>}
                {error && (
                    <div className="text-center py-4">
                        <p className="text-amber-500">{error}</p>
                        {predictions.length > 0 && (
                            <p className="text-sm mt-2">Showing sample data for demonstration purposes.</p>
                        )}
                    </div>
                )}

                {!loading && (predictions.length > 0) && (
                    <>
                        <div className="flex flex-col md:flex-row items-center justify-between mb-6">
                            <div className="text-center md:text-left mb-4 md:mb-0">
                                <h3 className="text-lg opacity-70">Tomorrow's Average AQI</h3>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="text-4xl font-bold"
                                        style={{ color: tomorrowAQIColor }}
                                    >
                                        {tomorrowAQI}
                                    </div>
                                    <div className="text-sm opacity-80">
                                        {tomorrowAQI <= 50 ? "Good" :
                                            tomorrowAQI <= 100 ? "Moderate" :
                                                tomorrowAQI <= 150 ? "Unhealthy for Sensitive Groups" :
                                                    tomorrowAQI <= 200 ? "Unhealthy" :
                                                        tomorrowAQI <= 300 ? "Very Unhealthy" : "Hazardous"}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 flex-wrap justify-center">
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full bg-[#00e400] mr-2"></div>
                                    <span className="text-xs">Good (0-50)</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full bg-[#ffff00] mr-2"></div>
                                    <span className="text-xs">Moderate (51-100)</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full bg-[#ff7e00] mr-2"></div>
                                    <span className="text-xs">Unhealthy for Sensitive Groups (101-150)</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full bg-[#ff0000] mr-2"></div>
                                    <span className="text-xs">Unhealthy (151-200)</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={predictions}
                                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                    <XAxis
                                        dataKey="hour"
                                        label={{ value: "Hours from now", position: "insideBottomRight", offset: -10 }}
                                        tickFormatter={(hour) => `+${hour}h`}
                                    />
                                    <YAxis
                                        label={{ value: "AQI", angle: -90, position: "insideLeft" }}
                                        domain={[0, 'dataMax + 20']}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`AQI: ${value}`, "Predicted AQI"]}
                                        labelFormatter={(hour) => `${hour} hours from now`}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="aqi"
                                        name="AQI"
                                        stroke="#8884d8"
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                        activeDot={{ r: 8 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <p className="mt-4 text-sm opacity-70 text-center">
                            These predictions are based on historical air quality data and weather patterns.
                            Actual conditions may vary based on local emissions and weather changes.
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default AQIPredictionChart;