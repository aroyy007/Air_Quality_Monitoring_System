import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from "recharts";

const AQIChart = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistoricalData = async () => {
            try {
                setLoading(true);
                console.log("Fetching historical data...");
                const response = await fetch('http://localhost:5000/api/weather/historical');
                
                if (!response.ok) {
                    throw new Error(`Historical data error: ${response.status}`);
                }
                
                const result = await response.json();
                console.log("Historical data received:", result);
                
                // Make sure we have data with the right format
                if (Array.isArray(result) && result.length > 0) {
                    // Add dummy data if we have less than 2 points (for testing)
                    if (result.length < 2) {
                        const sampleData = [
                            { date: "Feb 1", aqi: 50 },
                            { date: "Feb 5", aqi: 45 },
                            { date: "Feb 10", aqi: 60 },
                            { date: "Feb 15", aqi: 40 },
                            { date: "Feb 20", aqi: 55 },
                            { date: "Feb 25", aqi: 65 }
                        ];
                        setData([...result, ...sampleData.slice(0, 6 - result.length)]);
                    } else {
                        setData(result);
                    }
                } else {
                    console.warn("Received empty or invalid data from API");
                    // Provide sample data when no real data is available (for development)
                    setData([
                        { date: "Feb 1", aqi: 50 },
                        { date: "Feb 5", aqi: 45 },
                        { date: "Feb 10", aqi: 60 },
                        { date: "Feb 15", aqi: 40 },
                        { date: "Feb 20", aqi: 55 },
                        { date: "Feb 25", aqi: 65 }
                    ]);
                }
                
                setError(null);
            } catch (error) {
                console.error("Historical fetch error:", error);
                setError(error.message);
                
                // Set fallback data for development/testing
                setData([
                    { date: "Feb 1", aqi: 50 },
                    { date: "Feb 5", aqi: 45 },
                    { date: "Feb 10", aqi: 60 },
                    { date: "Feb 15", aqi: 40 },
                    { date: "Feb 20", aqi: 55 },
                    { date: "Feb 25", aqi: 65 }
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchHistoricalData();
        const interval = setInterval(fetchHistoricalData, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const CustomDot = (props: any) => {
        const { cx, cy, payload } = props;
        const color = payload.aqi >= 100 ? "#ea384c" :
            payload.aqi <= 50 ? "#4caf50" :
                "#8884d8";

        return (
            <circle
                cx={cx}
                cy={cy}
                r={4}
                stroke={color}
                strokeWidth={2}
                fill="#1a1a1a"
            />
        );
    };

    return (
        <div className="w-full h-[300px] md:h-[400px] glass-panel p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4 text-white/90">
                AQI Trend - Last 30 Days
            </h2>

            {loading ? (
                <div className="text-center text-white/60 h-full flex items-center justify-center">
                    Loading chart data...
                </div>
            ) : error ? (
                <div className="text-center text-red-500 h-full flex items-center justify-center">
                    Chart data unavailable: {error}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="85%">
                    <LineChart
                        data={data}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis
                            dataKey="date"
                            stroke="#ffffff60"
                            tick={{ fill: "#ffffff60", fontSize: 12 }}
                            tickLine={{ stroke: "#ffffff30" }}
                        />
                        <YAxis
                            stroke="#ffffff60"
                            tick={{ fill: "#ffffff60", fontSize: 12 }}
                            tickLine={{ stroke: "#ffffff30" }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "rgba(0, 0, 0, 0.9)",
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "8px",
                            }}
                            formatter={(value: number) => [value, "AQI"]}
                        />
                        {/* Reference lines for AQI categories */}
                        <ReferenceLine y={50} stroke="#4caf50" strokeDasharray="3 3" label="Good" />
                        <ReferenceLine y={100} stroke="#ffeb3b" strokeDasharray="3 3" label="Moderate" />
                        <ReferenceLine y={150} stroke="#ea384c" strokeDasharray="3 3" label="Unhealthy" />
                        
                        <Line
                            type="monotone"
                            dataKey="aqi"
                            stroke="#8884d8"
                            strokeWidth={2}
                            dot={<CustomDot />}
                            activeDot={{ r: 6 }}
                            animationDuration={1000}
                        />
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
};

export default AQIChart;