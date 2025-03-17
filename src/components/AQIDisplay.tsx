import { cn } from "@/lib/utils";

interface AQIDisplayProps {
  value: number;
  className?: string;
  onStatusChange: (status: string) => void;
}

const AQIDisplay = ({ value, className, onStatusChange }: AQIDisplayProps) => {
  // Determine color and label based on AQI value
  const getAQIStatus = (aqi: number) => {
    if (aqi <= 50) {
      return {
        color: "green",
        label: "Good",
        description: "Air quality is good, with minimal risk from pollution."
      };
    } else if (aqi <= 100) {
      return {
        color: "yellow",
        label: "Moderate",
        description: "Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution."
      };
    } else if (aqi <= 150) {
      return {
        color: "orange",
        label: "Unhealthy for Sensitive Groups",
        description: "Members of sensitive groups may experience health effects. The general public is less likely to be affected."
      };
    } else if (aqi <= 200) {
      return {
        color: "red",
        label: "Unhealthy",
        description: "Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects."
      };
    } else if (aqi <= 300) {
      return {
        color: "purple",
        label: "Very Unhealthy",
        description: "Health alert: The risk of health effects is increased for everyone."
      };
    } else {
      return {
        color: "maroon",
        label: "Hazardous",
        description: "Health warning of emergency conditions: everyone is more likely to be affected."
      };
    }
  };

  const status = getAQIStatus(value);
  onStatusChange(status.description);

  const getTextColor = () => {
    switch (status.color) {
      case "green":
        return "text-aqi-good";
      case "yellow":
        return "text-aqi-moderate";
      case "red":
        return "text-aqi-unhealthy";
      case "purple":
        return "text-aqi-hazardous";
      default:
        return "text-white";
    }
  };

  return (
    <div className={cn("text-center space-y-4", className)}>
      <div
        className={cn(
          "glow inline-block p-8 glass-panel transition-transform duration-300 hover:scale-105 hover:shadow-2xl",
          `glow-${status.color}`
        )}
      >
        <h1
          className={cn(
            "text-6xl font-bold mb-2 animate-number-change",
            getTextColor(),
            "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          )}
        >
          {value}
        </h1>
        <p className="text-xl text-white/90">AQI</p>
      </div>
      {/* <p className="text-lg text-white/80 max-w-md mx-auto animate-fade-in drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
        {status.description}
      </p> */}
    </div>
  );
};

export default AQIDisplay;
