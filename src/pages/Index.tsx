import { useEffect, useState } from "react";
import { Thermometer, Droplets, Wind, CloudRain, Factory, Cloud, Atom, AlertTriangle, Biohazard } from "lucide-react";
import AQIDisplay from "@/components/AQIDisplay";
import SensorCard from "@/components/SensorCard";
import { Meteors } from "@/components/Meteors";
import AQIChart from "@/components/AQIChart";
import AlertSubscription from "@/components/AlertSubscription";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface SensorReading {
    aqi: number;
    temperature: number;
    humidity: number;
    pm25: number;
    pm10: number;
    co: number;
    methane: number;
    airQuality: number;
    o3: number;
    so2: number;
    no2: number;
    nh3: number;
}

interface SensorStatus {
    status: "good" | "moderate" | "unhealthy" | "hazardous";
    message: string;
    color: "green" | "yellow" | "red" | "purple";
}

const Index = () => {
    const [data, setData] = useState<SensorReading>({
        aqi: 0,
        temperature: 0,
        humidity: 0,
        pm25: 0,
        pm10: 0,
        co: 0,
        methane: 0,
        airQuality: 0,
        o3: 0,
        so2: 0,
        no2: 0,
        nh3: 0,
    });

    const [sensorStatuses, setSensorStatuses] = useState<Record<string, SensorStatus>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [overallStatus, setOverallStatus] = useState<SensorStatus>({
        status: "good",
        message: "Air quality is good. Safe to go outside.",
        color: "green",
    });

    const [statusDescription, setStatusDescription] = useState("");

    const handleStatusChange = (description: string) => {
        setStatusDescription(description);
    };

    // Adjusted thresholds based on Arduino PPM ranges
    // Adjusted thresholds based on EPA standards
    const thresholds = {
        temperature: {
            good: { max: 25, message: "Comfortable temperature.", color: "green" },
            moderate: { max: 30, message: "Moderate temperature.", color: "yellow" },
            unhealthy: { max: 35, message: "High temperature.", color: "red" },
            hazardous: { message: "Extreme temperature.", color: "purple" },
        },
        humidity: {
            good: { max: 50, message: "Comfortable humidity.", color: "green" },
            moderate: { max: 65, message: "Moderate humidity.", color: "yellow" },
            unhealthy: { max: 80, message: "High humidity.", color: "red" },
            hazardous: { message: "Very high humidity.", color: "purple" },
        },
        pm25: {
            good: { max: 12, message: "Good PM2.5 levels.", color: "green" },
            moderate: { max: 35.4, message: "Moderate PM2.5 levels.", color: "yellow" },
            unhealthy: { max: 55.4, message: "Unhealthy PM2.5 levels.", color: "red" },
            hazardous: { message: "Hazardous PM2.5 levels.", color: "purple" },
        },
        pm10: {
            good: { max: 54, message: "Good PM10 levels.", color: "green" },
            moderate: { max: 154, message: "Moderate PM10 levels.", color: "yellow" },
            unhealthy: { max: 254, message: "Unhealthy PM10 levels.", color: "red" },
            hazardous: { message: "Hazardous PM10 levels.", color: "purple" },
        },
        co: {
            good: { max: 4.4, message: "Safe CO levels.", color: "green" }, // Updated to EPA values
            moderate: { max: 9.4, message: "Moderate CO levels.", color: "yellow" },
            unhealthy: { max: 12.4, message: "Unhealthy CO levels.", color: "red" },
            hazardous: { message: "Dangerous CO levels.", color: "purple" },
        },
        methane: {
            good: { max: 1000, message: "Safe methane levels.", color: "green" },
            moderate: { max: 5000, message: "Moderate methane levels.", color: "yellow" },
            unhealthy: { max: 10000, message: "Elevated methane levels.", color: "red" },
            hazardous: { message: "High methane levels.", color: "purple" },
        },
        airQuality: {
            good: { max: 50, message: "Good air quality.", color: "green" },
            moderate: { max: 100, message: "Moderate air quality.", color: "yellow" },
            unhealthy: { max: 150, message: "Poor air quality.", color: "red" },
            hazardous: { message: "Very poor air quality.", color: "purple" },
        },
        o3: {
            good: { max: 54, message: "Safe ozone levels.", color: "green" }, // Updated to EPA values
            moderate: { max: 70, message: "Moderate ozone levels.", color: "yellow" },
            unhealthy: { max: 85, message: "High ozone levels.", color: "red" },
            hazardous: { message: "Dangerous ozone levels.", color: "purple" },
        },
        so2: {
            good: { max: 35, message: "Safe SO₂ levels.", color: "green" }, // Updated to EPA values
            moderate: { max: 75, message: "Moderate SO₂ levels.", color: "yellow" },
            unhealthy: { max: 185, message: "High SO₂ levels.", color: "red" },
            hazardous: { message: "Dangerous SO₂ levels.", color: "purple" },
        },
        no2: {
            good: { max: 53, message: "Safe NO₂ levels.", color: "green" }, // Updated to EPA values
            moderate: { max: 100, message: "Moderate NO₂ levels.", color: "yellow" },
            unhealthy: { max: 360, message: "High NO₂ levels.", color: "red" },
            hazardous: { message: "Dangerous NO₂ levels.", color: "purple" },
        },
        nh3: {
            good: { max: 200, message: "Safe NH₃ levels.", color: "green" },
            moderate: { max: 400, message: "Moderate NH₃ levels.", color: "yellow" },
            unhealthy: { max: 800, message: "High NH₃ levels.", color: "red" },
            hazardous: { message: "Dangerous NH₃ levels.", color: "purple" },
        },
    };

    const determineStatus = (param: string, value: number): SensorStatus => {
        const paramThresholds = thresholds[param as keyof typeof thresholds];
        if (!paramThresholds) return { status: "good", message: "", color: "green" };

        if (value <= paramThresholds.good.max) {
            return { status: "good", message: paramThresholds.good.message, color: "green" };
        } else if (value <= paramThresholds.moderate.max) {
            return { status: "moderate", message: paramThresholds.moderate.message, color: "yellow" };
        } else if (value <= paramThresholds.unhealthy.max) {
            return { status: "unhealthy", message: paramThresholds.unhealthy.message, color: "red" };
        } else {
            return { status: "hazardous", message: paramThresholds.hazardous.message, color: "purple" };
        }
    };

    const determineOverallStatus = (statuses: Record<string, SensorStatus>): SensorStatus => {
        const priorities = { good: 0, moderate: 1, unhealthy: 2, hazardous: 3 };
        let worstStatus: SensorStatus = { status: "good", message: "All safe.", color: "green" };

        Object.values(statuses).forEach((status) => {
            if (priorities[status.status] > priorities[worstStatus.status]) {
                worstStatus = status;
            }
        });

        return { ...worstStatus, message: worstStatus.status === "good" ? "All safe." : `${worstStatus.status.charAt(0).toUpperCase() + worstStatus.status.slice(1)} conditions detected.` };
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("http://localhost:5000/api/weather");
                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                const result = await response.json();

                const newData: SensorReading = {
                    aqi: result.aqi || 0,
                    temperature: result.temperature || 0,
                    humidity: result.humidity || 0,
                    pm25: result.pm25 || 0,
                    pm10: result.pm10 || 0,
                    co: result.co || 0,
                    methane: result.methane || 0,
                    airQuality: result.airQuality || 0,
                    o3: result.o3 || 0,
                    so2: result.so2 || 0,
                    no2: result.no2 || 0,
                    nh3: result.nh3 || 0,
                };

                setData(newData);

                const newStatuses: Record<string, SensorStatus> = {
                    temperature: determineStatus("temperature", newData.temperature),
                    humidity: determineStatus("humidity", newData.humidity),
                    pm25: determineStatus("pm25", newData.pm25),
                    pm10: determineStatus("pm10", newData.pm10),
                    co: determineStatus("co", newData.co),
                    methane: determineStatus("methane", newData.methane),
                    airQuality: determineStatus("airQuality", newData.airQuality),
                    o3: determineStatus("o3", newData.o3),
                    so2: determineStatus("so2", newData.so2),
                    no2: determineStatus("no2", newData.no2),
                    nh3: determineStatus("nh3", newData.nh3),
                };

                setSensorStatuses(newStatuses);
                setOverallStatus(determineOverallStatus(newStatuses));
                setError(null);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 3000); // Poll every 3 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen w-full py-8 px-4 md:py-12 md:px-8 relative">
            <Meteors />
            <main className="max-w-7xl mx-auto space-y-12">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold typewriter colorful-border mb-4">
                        Air Quality Index
                    </h1>
                </div>

                {loading && <p>Loading...</p>}
                {error && <p>Error: {error}</p>}

                {!loading && !error && (
                    <>


                        <AQIDisplay value={data.aqi} className="mb-8" onStatusChange={handleStatusChange} />
                        <Alert className={`glass-panel mb-8 glow glow-${overallStatus.color} border-${overallStatus.color}-500`}>
                            <AlertTitle className="text-lg font-bold">Environmental Status</AlertTitle>
                            <AlertDescription className="text-white/90">{statusDescription}</AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <SensorCard title="Temperature" value={data.temperature} unit="°C" icon={Thermometer} glowColor={sensorStatuses.temperature?.color || "green"} description={sensorStatuses.temperature?.message} />
                            <SensorCard title="Humidity" value={data.humidity} unit="%" icon={Droplets} glowColor={sensorStatuses.humidity?.color || "green"} description={sensorStatuses.humidity?.message} />
                            <SensorCard title="PM2.5" value={data.pm25} unit="µg/m³" icon={Wind} glowColor={sensorStatuses.pm25?.color || "green"} description={sensorStatuses.pm25?.message} />
                            <SensorCard title="PM10" value={data.pm10} unit="µg/m³" icon={CloudRain} glowColor={sensorStatuses.pm10?.color || "green"} description={sensorStatuses.pm10?.message} />
                            <SensorCard title="O₃" value={data.o3} unit="ppb" icon={Cloud} glowColor={sensorStatuses.o3?.color || "green"} description={sensorStatuses.o3?.message} />
                            <SensorCard title="SO₂" value={data.so2} unit="µg/m³" icon={AlertTriangle} glowColor={sensorStatuses.so2?.color || "green"} description={sensorStatuses.so2?.message} />
                            <SensorCard title="CO" value={data.co} unit="ppm" icon={Factory} glowColor={sensorStatuses.co?.color || "green"} description={sensorStatuses.co?.message} />
                            <SensorCard title="Methane" value={data.methane} unit="ppm" icon={Atom} glowColor={sensorStatuses.methane?.color || "green"} description={sensorStatuses.methane?.message} />
                            <SensorCard title="Air Quality" value={data.airQuality} unit="ppm" icon={Cloud} glowColor={sensorStatuses.airQuality?.color || "green"} description={sensorStatuses.airQuality?.message} />
                            {/* <SensorCard title="NO₂" value={data.no2} unit="µg/m³" icon={Biohazard} glowColor={sensorStatuses.no2?.color || "green"} description={sensorStatuses.no2?.message} />
                            <SensorCard title="NH₃" value={data.nh3} unit="µg/m³" icon={Atom} glowColor={sensorStatuses.nh3?.color || "green"} description={sensorStatuses.nh3?.message} /> */}
                        </div>

                        <AlertSubscription />
                        <AQIChart />
                    </>
                )}
            </main>
        </div>
    );
};

export default Index;