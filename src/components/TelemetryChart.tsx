import { useId, useState } from "react";
import { FanTelemetry } from "../types";

export default function TelemetryChart({
  history,
}: {
  history: FanTelemetry[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const id = useId();
  if (!history.length) return <p className="empty">Waiting for readings.</p>;
  const width = 500,
    height = 170,
    left = 32,
    right = 466,
    top = 16,
    bottom = 140;
  const x = (index: number) =>
    history.length === 1
      ? (left + right) / 2
      : left + (index * (right - left)) / (history.length - 1);
  const minTemp = Math.min(
    30,
    ...history.map((point) => Math.floor(point.temp / 10) * 10),
  );
  const maxTemp = Math.max(
    80,
    ...history.map((point) => Math.ceil(point.temp / 10) * 10),
  );
  const y = (value: number, min: number, max: number) =>
    bottom - ((value - min) / (max - min)) * (bottom - top);
  const path = (key: "temp" | "speed") =>
    history
      .map(
        (point, index) =>
          `${index ? "L" : "M"}${x(index)},${y(point[key], key === "temp" ? minTemp : 0, key === "temp" ? maxTemp : 100)}`,
      )
      .join(" ");
  const index = Math.min(selected ?? history.length - 1, history.length - 1);
  const point = history[index];
  const time = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <div className="telemetry">
      <div className="chart-legend">
        <span>
          <i className="temp-line" />
          Temperature
        </span>
        <span>
          <i className="speed-line" />
          Fan output
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={id}
        tabIndex={0}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setSelected(
            Math.max(
              0,
              Math.min(
                history.length - 1,
                Math.round(
                  ((((event.clientX - rect.left) / rect.width) * width - left) /
                    (right - left)) *
                    (history.length - 1),
                ),
              ),
            ),
          );
        }}
        onPointerLeave={() => setSelected(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            setSelected(
              Math.max(
                0,
                Math.min(
                  history.length - 1,
                  index + (event.key === "ArrowLeft" ? -1 : 1),
                ),
              ),
            );
          }
        }}
      >
        <title id={id}>
          Temperature and fan output history. Use arrow keys to inspect
          readings.
        </title>
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1={left}
              x2={right}
              y1={top + ratio * (bottom - top)}
              y2={top + ratio * (bottom - top)}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <text
              x={left - 8}
              y={top + ratio * (bottom - top) + 4}
              textAnchor="end"
            >
              {Math.round(maxTemp - ratio * (maxTemp - minTemp))}°
            </text>
            <text x={right + 7} y={top + ratio * (bottom - top) + 4}>
              {100 - ratio * 100}%
            </text>
          </g>
        ))}
        <path
          d={path("speed")}
          fill="none"
          stroke="#8b929a"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d={path("temp")}
          fill="none"
          stroke="var(--blue)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(index)}
          cy={y(point.temp, minTemp, maxTemp)}
          r="4"
          fill="var(--blue)"
          stroke="white"
          strokeWidth="2"
        />
        <text x={left} y={165}>
          {time(history[0].timestamp)}
        </text>
        <text x={right} y={165} textAnchor="end">
          {time(history[history.length - 1].timestamp)}
        </text>
      </svg>
      <div className="chart-reading" aria-live="polite">
        <span>{time(point.timestamp)}</span>
        <strong>{point.temp.toFixed(1)}°C</strong>
        <span>{Math.round(point.speed)}% output</span>
      </div>
    </div>
  );
}
