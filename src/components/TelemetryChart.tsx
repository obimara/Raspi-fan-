import React, { useState } from 'react';
import { FanTelemetry } from '../types';

interface TelemetryChartProps {
  history: FanTelemetry[];
}

export default function TelemetryChart({ history }: TelemetryChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG parameters
  const width = 500;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 35;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (!history || history.length === 0) {
    return (
      <div className="h-[180px] w-full flex items-center justify-center bg-slate-950/20 rounded-xl border border-slate-800/50 backdrop-blur-md">
        <span className="text-xs text-slate-500 font-mono">No data points available</span>
      </div>
    );
  }

  // Find min/max values for scaling
  // Fixed reasonable bounds to avoid chart stretching and flickering
  const minTemp = 30; // 30°C standard bottom
  const maxTemp = 80; // 80°C top

  const minSpeed = 0;
  const maxSpeed = 100;

  // Coordinate conversion helpers
  const getX = (index: number) => {
    if (history.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (history.length - 1)) * chartWidth;
  };

  const getTempY = (temp: number) => {
    const clamped = Math.max(minTemp, Math.min(maxTemp, temp));
    const ratio = (clamped - minTemp) / (maxTemp - minTemp);
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  const getSpeedY = (speed: number) => {
    const clamped = Math.max(minSpeed, Math.min(maxSpeed, speed));
    const ratio = (clamped - minSpeed) / (maxSpeed - minSpeed);
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  // Build SVG Paths
  let tempPath = "";
  let speedPath = "";
  let tempArea = "";
  let speedArea = "";

  if (history.length > 0) {
    // Starting coordinates
    const startX = getX(0);
    const startTempY = getTempY(history[0].temp);
    const startSpeedY = getSpeedY(history[0].speed);

    tempPath = `M ${startX} ${startTempY}`;
    speedPath = `M ${startX} ${startSpeedY}`;
    
    tempArea = `M ${startX} ${paddingTop + chartHeight} L ${startX} ${startTempY}`;
    speedArea = `M ${startX} ${paddingTop + chartHeight} L ${startX} ${startSpeedY}`;

    for (let i = 1; i < history.length; i++) {
      const cx = getX(i);
      const cyTemp = getTempY(history[i].temp);
      const cySpeed = getSpeedY(history[i].speed);

      tempPath += ` L ${cx} ${cyTemp}`;
      speedPath += ` L ${cx} ${cySpeed}`;
      tempArea += ` L ${cx} ${cyTemp}`;
      speedArea += ` L ${cx} ${cySpeed}`;
    }

    const endX = getX(history.length - 1);
    tempArea += ` L ${endX} ${paddingTop + chartHeight} Z`;
    speedArea += ` L ${endX} ${paddingTop + chartHeight} Z`;
  }

  // Handle hover interactives
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x - (paddingLeft / width) * rect.width) / ((chartWidth / width) * rect.width);
    const index = Math.max(0, Math.min(history.length - 1, Math.round(pct * (history.length - 1))));
    setHoveredIdx(index);
  };

  const activePoint = hoveredIdx !== null ? history[hoveredIdx] : null;

  return (
    <div className="relative group/chart w-full bg-black/35 rounded-3xl border border-white/5 p-4 shadow-xl hover:border-white/10 transition-colors">
      
      {/* Legend & Hover Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            <span className="text-[10px] sm:text-xs text-rose-200 font-mono tracking-tight font-medium">CPU Temp (°C)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
            <span className="text-[10px] sm:text-xs text-teal-200 font-mono tracking-tight font-medium">Fan Speed (%)</span>
          </div>
        </div>

        {/* Dynamic Tooltip Value Header */}
        <div className="h-5 flex items-center">
          {activePoint ? (
            <div className="flex gap-3 text-[10px] font-mono text-white/90 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
              <span>{new Date(activePoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="text-rose-400 font-extrabold">{activePoint.temp}°C</span>
              <span className="text-teal-400 font-extrabold">{activePoint.speed}%</span>
            </div>
          ) : (
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Hover graph to inspect values</span>
          )}
        </div>
      </div>

      {/* Main Graph SVG */}
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        className="overflow-visible cursor-crosshair select-none"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="tempGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="speedGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + ratio * chartHeight;
          const tempVal = Math.round(maxTemp - ratio * (maxTemp - minTemp));
          const speedVal = Math.round(maxSpeed - ratio * (maxSpeed - minSpeed));

          return (
            <g key={i} className="opacity-30 hover:opacity-50 transition-opacity">
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="#ffffff" 
                strokeWidth="0.75" 
                strokeDasharray="2,4" 
              />
              {/* Temp axis label on left */}
              <text 
                x={paddingLeft - 8} 
                y={y + 3.5} 
                fill="#fda4af" 
                fontSize="8" 
                fontFamily="monospace"
                textAnchor="end"
              >
                {tempVal}°
              </text>
              {/* Speed axis label on right */}
              <text 
                x={width - paddingRight + 8} 
                y={y + 3.5} 
                fill="#99f6e4" 
                fontSize="8" 
                fontFamily="monospace"
                textAnchor="start"
              >
                {speedVal}%
              </text>
            </g>
          );
        })}

        {/* Sub-areas with gradients */}
        <path d={tempArea} fill="url(#tempGlow)" className="transition-all duration-300" />
        <path d={speedArea} fill="url(#speedGlow)" className="transition-all duration-300" />

        {/* Lines */}
        <path 
          d={tempPath} 
          fill="none" 
          stroke="#f43f5e" 
          strokeWidth="2.2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="transition-all duration-300 drop-shadow-[0_2px_6px_rgba(244,63,94,0.4)]"
        />
        <path 
          d={speedPath} 
          fill="none" 
          stroke="#14b8a6" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="transition-all duration-300 drop-shadow-[0_2px_6px_rgba(20,184,166,0.4)]"
        />

        {/* Interactive Hover Probe Bar */}
        {hoveredIdx !== null && (
          <g>
            <line 
              x1={getX(hoveredIdx)} 
              y1={paddingTop} 
              x2={getX(hoveredIdx)} 
              y2={paddingTop + chartHeight} 
              stroke="#ffffff" 
              strokeWidth="0.75" 
              strokeDasharray="1,2" 
              className="opacity-40"
            />
            {/* Temp dot */}
            <circle 
              cx={getX(hoveredIdx)} 
              cy={getTempY(history[hoveredIdx].temp)} 
              r="4.5" 
              fill="#ef4444" 
              stroke="#ffffff" 
              strokeWidth="1.5"
              className="shadow-sm"
            />
            {/* Speed dot */}
            <circle 
              cx={getX(hoveredIdx)} 
              cy={getSpeedY(history[hoveredIdx].speed)} 
              r="4" 
              fill="#14b8a6" 
              stroke="#ffffff" 
              strokeWidth="1.5"
              className="shadow-sm"
            />
          </g>
        )}
      </svg>
      
      {/* Footer info indicating scale timeline */}
      <div className="flex justify-between items-center mt-1 px-1 text-[8px] font-mono text-white/30 uppercase tracking-widest font-bold">
        <span>Timeline - Logs sync stream</span>
        <span>Live response</span>
      </div>
    </div>
  );
}
