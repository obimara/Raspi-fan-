import React from 'react';

interface FanIconProps {
  speed: number; // 0 - 100
  size?: number;  // px
}

export default function FanIcon({ speed, size = 180 }: FanIconProps) {
  // Map speed to rotational speed (seconds per rotation)
  // 0% speed = no rotation
  // 100% speed = 0.4s rotation
  const duration = speed === 0 ? 0 : Math.max(0.3, 3 - (speed / 100) * 2.7);

  return (
    <div 
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer Shroud Ring with subtle radial glow */}
      <div className="absolute inset-0 rounded-full border-2 border-slate-700/60 bg-slate-950/40 shadow-inner flex items-center justify-center p-2 backdrop-blur-md">
        <div className="absolute inset-0.5 rounded-full border border-dashed border-slate-500/20 animate-[spin_120s_linear_infinite]" />
      </div>

      {/* Fan Blades Group */}
      <div 
        className="w-4/5 h-4/5 relative flex items-center justify-center"
        style={{
          animationName: speed > 0 ? 'spin' : 'none',
          animationDuration: `${duration}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite'
        }}
      >
        {/* Core rotor cap */}
        <div className="absolute w-1/4 h-1/4 rounded-full bg-linear-to-br from-zinc-400 to-zinc-700 z-20 shadow-md border border-slate-600/80 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-zinc-900" />
        </div>

        {/* 7 Curved aerodynamic aerofoil blades */}
        {[...Array(7)].map((_, i) => {
          const rotation = (i * 360) / 7;
          return (
            <div
              key={i}
              className="absolute w-1/2 h-10 origin-left"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${rotation}deg) translateY(-50%)`,
              }}
            >
              {/* Blade layout: stylish tapered shape with gradient highlights */}
              <div 
                className="w-[120%] h-full bg-linear-to-r from-zinc-700/90 via-zinc-500/90 to-zinc-800/80 rounded-r-full shadow-[0_1px_4px_rgba(0,0,0,0.5)] border-t border-r border-zinc-400/20"
                style={{
                  transform: 'skewX(25deg)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Speed Dust Accents */}
      {speed > 10 && (
        <div className="absolute inset-2 pointer-events-none rounded-full overflow-hidden">
          <div 
            className="w-full h-full border border-teal-500/10 rounded-full animate-ping opacity-45"
            style={{ animationDuration: `${duration * 1.5}s` }}
          />
        </div>
      )}

      {/* Critical CSS Animation block injected in header or scoped */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
