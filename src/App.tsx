import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Settings, 
  Terminal as TerminalIcon, 
  Download, 
  HelpCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Wifi, 
  WifiOff, 
  Thermometer, 
  ExternalLink,
  Layers,
  Sparkles,
  Power,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FanState, ControlMode } from './types';
import TelemetryChart from './components/TelemetryChart';
import DaemonTerminal from './components/DaemonTerminal';
import DesktopWindow from './components/DesktopWindow';

export default function App() {
  // Main State Loaded from full-stack API
  const [state, setState] = useState<FanState & { isOnline?: boolean }>({
    speed: 45,
    mode: "auto",
    targetTemp: 55,
    currentTemp: 42.5,
    currentSpeed: 45,
    hostname: "raspberrypi",
    lastSeen: null,
    history: [],
    daemonLogs: [],
    isOnline: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isMixerOpen, setIsMixerOpen] = useState(false); // Start compacted for seamless desktop integration
  const [wallpaperEnabled, setWallpaperEnabled] = useState(false); // Start with completely transparent canvas
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'mixer' | 'diagnostics' | 'install'>('mixer');

  // Fetch the latest state from Express
  const fetchState = async (showUpdatingIndicator = false) => {
    if (showUpdatingIndicator) setIsUpdating(true);
    try {
      const res = await fetch('/api/fan/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (e) {
      console.error("Error communicating with remote fan controller service", e);
    } finally {
      setIsLoading(false);
      if (showUpdatingIndicator) {
        setTimeout(() => setIsUpdating(false), 300);
      }
    }
  };

  // Continuous API sync loop
  useEffect(() => {
    fetchState();
    const interval = setInterval(() => fetchState(), 2500);
    return () => clearInterval(interval);
  }, []);

  // Update central states on slider trigger
  const handleControlUpdate = async (updates: { speed?: number; mode?: ControlMode; targetTemp?: number }) => {
    // Optimistic UI state update
    setState(prev => ({
      ...prev,
      ...updates,
      // If we change speed manually, set mode to manual to represent a mixer interaction
      mode: updates.mode !== undefined ? updates.mode : (updates.speed !== undefined ? 'manual' : prev.mode)
    }));

    try {
      await fetch('/api/fan/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          // Sync manual override mode
          mode: updates.mode !== undefined ? updates.mode : (updates.speed !== undefined ? 'manual' : state.mode)
        })
      });
    } catch (e) {
      console.error("Error sending control updates", e);
    }
  };

  // Trigger server log clearing
  const handleClearLogs = async () => {
    try {
      // Just clear local state, server will pick up
      setState(prev => ({ ...prev, daemonLogs: [] }));
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger click copying feedback with robust fallback for iframe environment constraints
  const handleCopy = async (text: string, id: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for secured sandboxed contexts or if clipboard API is blocked in the iframe
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.warn("Iframe secure clipboard block detected, fallback executed without crash:", err);
      // Ensure visual feedback still operates so users are never stuck
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  // Auto detect current server URL for daemon downloads
  const daemonCurlCommand = `python3 -c "$(curl -fsSL ${window.location.origin}/api/daemon_script)"`;
  
  const systemdServiceContent = `[Unit]
Description=Raspberry Pi Remote Fan Controller Client
After=network.target

[Service]
ExecStart=/usr/bin/python3 -c "$(curl -fsSL ${window.location.origin}/api/daemon_script)"
Restart=on-failure
User=root

[Install]
WantedBy=multi-user.target`;

  // Thermal Badge Indicators Color Scale
  const getTempColor = (temp: number) => {
    if (temp >= 70) return { bg: "bg-rose-500/10 border-rose-500/40 text-rose-400 font-bold animate-pulse", text: "text-rose-400", glow: "shadow-rose-500/20" };
    if (temp >= 55) return { bg: "bg-amber-500/10 border-amber-500/30 text-amber-400", text: "text-amber-400", glow: "shadow-amber-500/10" };
    return { bg: "bg-sky-500/10 border-sky-500/30 text-sky-400", text: "text-sky-400", glow: "shadow-sky-500/15" };
  };

  const tempStyles = getTempColor(state.currentTemp);

  return (
    <div 
      className={`relative w-full h-screen overflow-hidden select-none transition-all duration-500 ${wallpaperEnabled ? "bg-[#0f172a]" : "bg-transparent"}`}
      id="main-desktop-canvas"
    >
      {/* Frosted Glass ambient backgrounds & gradients - drawing only if wallpaper preview is active */}
      {wallpaperEnabled && (
        <>
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/30 via-transparent to-rose-900/30 pointer-events-none" />
          <div className="absolute top-10 left-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Dynamic Animated Atmospheric Particle Background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-40" />
        </>
      )}
      
      {/* Simulated Desktop Status Top Rail Bar - drawing only if wallpaper is enabled */}
      {wallpaperEnabled && (
        <div className="absolute top-0 inset-x-0 h-8 bg-black/30 backdrop-blur-md border-b border-white/10 z-30 flex items-center justify-between px-4 text-xs font-medium text-white/70">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <img src="https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=80&fit=crop&q=80" className="w-5 h-5 rounded-md object-cover border border-white/10 pointer-events-none select-none" alt="" referrerPolicy="no-referrer" />
            </div>
            <span className="text-[10px] sm:text-xs font-sans text-white/95 font-medium tracking-wide">DEBIAN TRIXIE PI CONSOLE</span>
            
            <div className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/60 font-mono">
              {state.isOnline ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  client_online: {state.hostname}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  client_offline: simulation
                </span>
              )}
            </div>
          </div>

          {/* Action icons & Live system digital clock */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fetchState(true)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
              id="force-refresh-telemetry"
              title="Refresh Daemon Telemetry"
            >
              <RefreshCw className={`w-3 h-3 ${isUpdating ? "animate-spin text-emerald-400" : ""}`} />
            </button>
            
            <button 
              onClick={() => setIsMixerOpen(true)}
              className="px-2.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-sans text-[10px] font-medium transition-all cursor-pointer flex items-center gap-1.5"
              id="open-mixer-header-btn"
            >
              <Layers className="w-3 h-3" />
              Fader Console
            </button>

            <span className="text-[11px] font-mono text-white/50 tracking-wider">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
            </span>
          </div>
        </div>
      )}

      {/* COMPACT FLOATING ACTIVE TRANSPARENT STATUS BAR (Only shown when console is minimized) */}
      <AnimatePresence>
        {!isMixerOpen && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-30">
            <motion.div
              drag
              dragMomentum={false}
              dragElastic={0.05}
              initial={{ opacity: 0, y: -20, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileDrag={{ scale: 1.05 }}
              onClick={() => setIsMixerOpen(true)}
              className="pointer-events-auto cursor-grab active:cursor-grabbing w-[390px] max-w-full rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 hover:border-white/25 hover:bg-black/55 shadow-2xl p-2.5 pl-4 pr-3 flex items-center justify-between gap-3 group relative transition-all"
              id="floating-compact-bar"
              title="Drag me on your desktop! Click to expand console controls."
            >
              {/* Elegant glow overlay */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 via-emerald-500/5 to-rose-500/5 opacity-40 pointer-events-none" />

              {/* Status indicator + Host info */}
              <div className="flex items-center gap-2.5 max-w-[130px] min-w-0">
                <div className="relative shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/70 select-none pointer-events-none">
                  <Cpu className="w-4 h-4 text-cyan-300" />
                  {state.isOnline && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-black animate-pulse" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-mono font-bold text-white/90 uppercase tracking-widest truncate">
                    {state.hostname}
                  </span>
                  <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider block truncate">
                    {state.mode === 'auto' ? '🔥 auto-temp' : '🔌 manual'}
                  </span>
                </div>
              </div>

              {/* Stats readout */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Temp */}
                <div className="flex items-center gap-1 bg-white/5 rounded-full pl-2 pr-2.5 py-1 border border-white/5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${state.currentTemp > 60 ? "bg-rose-500 animate-pulse" : "bg-emerald-400"}`} />
                  <span className="text-[11px] font-mono font-bold text-rose-300">
                    {state.currentTemp}°C
                  </span>
                </div>

                {/* Speed */}
                <div className="flex items-center gap-1 bg-white/5 rounded-full px-2.5 py-1 border border-white/5">
                  <span className="text-[11px] font-mono font-bold text-cyan-300">
                    {state.currentSpeed}%
                  </span>
                </div>
              </div>

              {/* Direct interactive controls inside the compact bar */}
              <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                {/* Inline Mode Switcher */}
                <button
                  onClick={() => handleControlUpdate({ mode: state.mode === 'auto' ? 'manual' : 'auto' })}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer"
                  title={`Switch to ${state.mode === 'auto' ? 'Manual' : 'Curve Auto'} Mode`}
                >
                  {state.mode === 'auto' ? <Sparkles className="w-3.5 h-3.5 text-cyan-300" /> : <Power className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                {/* Direct Telemetry Refresh */}
                <button
                  onClick={() => fetchState(true)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/90 transition-all cursor-pointer"
                  title="Query sensor update"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin text-emerald-400" : ""}`} />
                </button>

                {/* Expand Chevron button */}
                <button
                  onClick={() => setIsMixerOpen(true)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all cursor-pointer hover:scale-105"
                  title="Expand to Full Control Console"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Simulated Instructional Labels on empty simulated desktop */}
      {wallpaperEnabled && !isMixerOpen && (
        <div className="absolute bottom-12 left-6 text-white/40 text-[10px] font-sans tracking-wide max-w-sm flex flex-col gap-1 pointer-events-none select-none z-10">
          <span className="text-white/60 uppercase font-mono tracking-widest font-bold">PI_FAN OS CONTROLLER</span>
          <span>• drag the floating fan widget out of focus to view desktop wallpaper</span>
          <span>• click on widget or use the menu rail to relaunch mixer controls</span>
        </div>
      )}

      {/* MINIMALIST WALLPAPER & STATE CONTROL OVERLAY IN VIEWPORT RAIL */}
      <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-1 px-3 text-[10px] text-white/60">
          <span>Desktop Simulator:</span>
          <button 
            onClick={() => setWallpaperEnabled(!wallpaperEnabled)}
            className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold cursor-pointer transition-all ${wallpaperEnabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-white/40 hover:text-white/70 border border-white/5"}`}
            title="Toggle between a simulated wallpaper background and a native transparent layout."
          >
            {wallpaperEnabled ? "PREVIEW_ON" : "TRANSPARENT_OFF"}
          </button>
        </div>

        {!isMixerOpen && (
          <button
            onClick={() => setIsMixerOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/10 p-1.5 rounded-full text-[10px] font-medium transition-all shadow-lg cursor-pointer flex items-center justify-center hover:scale-105"
            title="Maximize full control console"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* PRIMARY CONTROLLER GLASS WINDOW */}
      <DesktopWindow
        title={`Rasp-Pi Fan Controller: ${state.hostname}`}
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        widthClass="max-w-3xl"
      >
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* LEFT CONSOLE COLUMN: MIXER FADERS & CONTROLS */}
          <div className="w-full md:w-[42%] flex flex-col gap-5">
            
            {/* MODE SWITCHER PANEL */}
            <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-2">Mode Select</div>
              <div className="flex gap-1 bg-black/40 p-1 rounded-2xl">
                <button 
                  onClick={() => handleControlUpdate({ mode: 'manual' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${state.mode === 'manual' ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-white/40 hover:text-white/70"}`}
                  id="mode-manual-btn"
                >
                  <Power className="w-3.5 h-3.5" />
                  Manual
                </button>
                <button 
                  onClick={() => handleControlUpdate({ mode: 'auto' })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${state.mode === 'auto' ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-white/40 hover:text-white/70"}`}
                  id="mode-auto-btn"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto Temp
                </button>
              </div>
            </div>

            {/* DUAL MIXER DESK HOUSING */}
            <div className="flex-1 bg-white/5 rounded-3xl p-5 border border-white/5 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />

              <div className="flex justify-around items-stretch h-[220px] relative px-2">
                
                {/* MIXER FADER CHANNEL 1: FAN DUCT VOLUME SPEED (MANUAL) */}
                <div className={`flex flex-col items-center gap-2 transition-opacity ${state.mode === 'auto' ? 'opacity-35 hover:opacity-75' : 'opacity-100'}`}>
                  <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider font-bold">Speed Fader</span>
                  
                  {/* Slider Housing Channel */}
                  <div className="relative w-12 h-[160px] flex justify-center bg-black/40 rounded-full border border-white/5 p-1.5 shadow-inner group py-3">
                    {/* Glowing background in the fader path */}
                    <div className="absolute inset-x-1.5 bottom-1.5 bg-gradient-to-t from-cyan-500 to-emerald-400 rounded-full blur-[2px] opacity-25 pointer-events-none" style={{ height: `${state.speed}%` }} />

                    {/* Tick markings */}
                    <div className="absolute left-2.5 inset-y-4 flex flex-col justify-between text-[6px] font-mono text-white/30 group-hover:text-white/60 pointer-events-none select-none z-10">
                      <span>100</span><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span>
                    </div>

                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="1"
                      value={state.speed}
                      onChange={(e) => handleControlUpdate({ speed: parseInt(e.target.value) })}
                      className="accent-white h-full w-2 flex cursor-pointer vertical-slider-custom z-20"
                      style={{
                        WebkitAppearance: 'slider-vertical',
                      }}
                      id="speed-mixer-fader"
                      title="Set target fan speed directly"
                    />
                  </div>

                  <span className="text-[11px] font-mono font-bold text-cyan-300 group-hover:scale-105 transition-transform">
                    {state.speed}%
                  </span>
                </div>

                {/* MIXER FADER CHANNEL 2: THERMAL TARGET LIMIT (AUTO) */}
                <div className={`flex flex-col items-center gap-2 transition-opacity ${state.mode === 'manual' ? 'opacity-35 hover:opacity-75' : 'opacity-100'}`}>
                  <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider font-bold">Smart Limit</span>
                  
                  {/* Slider Housing Channel */}
                  <div className="relative w-12 h-[160px] flex justify-center bg-black/40 rounded-full border border-white/5 p-1.5 shadow-inner group py-3">
                    {/* Glowing background in the fader path */}
                    {(() => {
                      const tempPercent = ((state.targetTemp - 35) / 50) * 100;
                      return (
                        <div className="absolute inset-x-1.5 bottom-1.5 bg-gradient-to-t from-rose-500 to-amber-400 rounded-full blur-[2px] opacity-25 pointer-events-none" style={{ height: `${tempPercent}%` }} />
                      );
                    })()}

                    {/* Tick markings */}
                    <div className="absolute left-2.5 inset-y-4 flex flex-col justify-between text-[6px] font-mono text-white/30 group-hover:text-white/60 pointer-events-none select-none z-10">
                      <span>85°</span><span>75°</span><span>65°</span><span>55°</span><span>45°</span><span>35°</span>
                    </div>

                    <input 
                      type="range" 
                      min="35" 
                      max="85" 
                      step="5"
                      value={state.targetTemp}
                      onChange={(e) => handleControlUpdate({ targetTemp: parseInt(e.target.value) })}
                      className="accent-white h-full w-2 flex cursor-pointer vertical-slider-custom z-20"
                      style={{
                        WebkitAppearance: 'slider-vertical'
                      }}
                      id="temp-target-fader"
                      title="Set target thermal limit curve trigger point"
                    />
                  </div>

                  <span className="text-[11px] font-mono font-bold text-rose-300 group-hover:scale-105 transition-transform">
                    {state.targetTemp}°C
                  </span>
                </div>

              </div>

              {/* Status information badge footer */}
              <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-center font-mono text-white/60 flex flex-col gap-1">
                {state.mode === 'manual' ? (
                  <span className="text-emerald-400 capitalize bg-white/5 py-1.5 px-3 rounded-xl border border-white/5">
                    Service: fancontrol.service manual ({state.speed}%)
                  </span>
                ) : (
                  <span className="text-cyan-400 capitalize bg-white/5 py-1.5 px-3 rounded-xl border border-white/5 animate-pulse">
                    Service: fancontrol.service active ({state.targetTemp}°C)
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT VIEW COLUMN: TABS SYSTEM (CHART, TERMINAL, INSTALL OVERLAY) */}
          <div className="flex-1 flex flex-col gap-4">
            
            {/* TABS DECK SELECTORS */}
            <div className="flex border-b border-white/10">
              <button 
                onClick={() => setActiveTab('mixer')}
                className={`py-2 px-3 text-xs font-sans font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'mixer' ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"}`}
                id="menu-tab-live"
              >
                Telemetry HUD
              </button>
              <button 
                onClick={() => setActiveTab('diagnostics')}
                className={`py-2 px-3 text-xs font-sans font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'diagnostics' ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"}`}
                id="menu-tab-diagnostics"
              >
                Diagnostic Logs
              </button>
              <button 
                onClick={() => setActiveTab('install')}
                className={`py-2 px-3 text-xs font-sans font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'install' ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"}`}
                id="menu-tab-client"
              >
                Hardware daemon
              </button>
            </div>

            {/* TAB CONTAINER 1: MIXER INTERFACE TELEMETRY */}
            {activeTab === 'mixer' && (
              <div className="flex-1 flex flex-col gap-4 justify-between">
                
                {/* THREE-CHANNEL DIALS / STATE READING METRICS */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Metric 1 */}
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-center">
                    <span className="text-[8px] font-mono tracking-widest text-white/40 uppercase flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-300" /> Host
                    </span>
                    <span className="text-xs sm:text-sm font-sans font-semibold text-white/95 truncate mt-1">
                      {state.hostname}
                    </span>
                  </div>

                  {/* Metric 2 */}
                  <div className={`bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-center transition-all ${state.currentTemp > 65 ? "shadow-[inset_0_0_12px_rgba(239,68,68,0.15)]" : ""}`}>
                    <span className="text-[8px] font-mono tracking-widest text-white/40 uppercase flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-rose-300" /> Core
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-rose-400 mt-1">
                      {state.currentTemp}°C
                    </span>
                  </div>

                  {/* Metric 3 */}
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col justify-center">
                    <span className="text-[8px] font-mono tracking-widest text-white/40 uppercase flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-cyan-300" /> Speed
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-cyan-400 mt-1">
                      {state.currentSpeed}%
                    </span>
                  </div>
                </div>

                {/* GRAPH */}
                <div className="flex-1 min-h-[190px]">
                  <TelemetryChart history={state.history} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/5 text-[10px] text-white/60 leading-normal">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-white/10 text-white/80">
                      <ExternalLink className="w-3 h-3" />
                    </div>
                    <span>
                      The controller matches fan curve outputs in real-time. Want to link your actual Pi? Drag over to the <strong>Hardware Daemon</strong> tab!
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTAINER 2: LOGGING DIAGNOSTICS */}
            {activeTab === 'diagnostics' && (
              <div className="flex-1 flex flex-col gap-4">
                <DaemonTerminal 
                  logs={state.daemonLogs} 
                  onClearLogs={handleClearLogs} 
                />
                
                <div className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-white/70 tracking-wider flex items-center gap-1.5 font-bold">
                    <Settings className="w-3.5 h-3.5" /> Thermal Limit Guideline
                  </span>
                  <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                    Debian Trixie (and Pi 4 / 5 OS) thermal-limits CPU cores automatically. Broadcom cores experience throttle protection at <strong>80°C</strong>. Keeping your fan trigger target at <strong>55°C</strong> ensures stable, lifetime protection for high-load projects!
                  </p>
                </div>
              </div>
            )}

            {/* TAB CONTAINER 3: PYTHON DAEMON INSTALL INSTRUCTIONS */}
            {activeTab === 'install' && (
              <div className="flex-1 overflow-y-auto space-y-4 max-h-[360px] pr-1">
                
                {/* SECTION: CONNECT TELEMETRY */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-black/40 p-3 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-mono text-white uppercase tracking-wider font-bold">Option A: Quick Daemon Launch Command</span>
                    <span className="text-[9.5px] px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-medium">No Install Needed</span>
                  </div>
                  <p className="text-[10px] text-white/50 leading-relaxed font-sans px-1">
                    Log into your Raspberry Pi terminal via SSH and blindly copy-paste this curl daemon launcher sequence. It downloads our Python script and launches it instantly:
                  </p>
                  
                  {/* Command box with single-click copy */}
                  <div className="relative flex items-center bg-black/50 border border-white/5 rounded-2xl p-3.5 font-mono text-[10px] text-white">
                    <div className="flex-1 pr-10 overflow-x-auto select-all whitespace-nowrap scrollbar-none">
                      {daemonCurlCommand}
                    </div>
                    <button
                      onClick={() => handleCopy(daemonCurlCommand, 'curl_run')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      id="copy-curl-btn"
                    >
                      {copiedIndex === 'curl_run' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* SECTION: SYSTEMD SERVICE */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-[10px] font-mono text-white uppercase tracking-wider font-bold block mb-1">Option B: Persistent Background systemd Service</span>
                  <p className="text-[10px] text-white/50 leading-relaxed font-sans px-1">
                    To keep the control client running persistently in the background after reboots, create a unit file `/etc/systemd/system/pifan.service`:
                  </p>

                  <div className="relative rounded-2xl overflow-hidden border border-white/5 bg-black/50 font-mono text-[9px] text-white/80">
                    <div className="bg-white/5 px-4 py-2 text-[8px] text-white/40 border-b border-white/5 flex justify-between items-center">
                      <span>/etc/systemd/system/pifan.service</span>
                      <button 
                        onClick={() => handleCopy(systemdServiceContent, 'systemd')}
                        className="text-[9px] py-1 px-3 bg-black/45 rounded-lg border border-white/10 text-white/60 hover:text-emerald-400 hover:border-white/20 cursor-pointer transition-all"
                        id="copy-systemd-btn"
                      >
                        {copiedIndex === 'systemd' ? 'Copied' : 'Copy Unit'}
                      </button>
                    </div>
                    <pre className="p-4 overflow-x-auto pr-12 text-white/60">
                      {systemdServiceContent}
                    </pre>
                  </div>

                  <div className="text-[9.5px] font-mono text-white/40 space-y-1.5 pl-1.5">
                    <div>1. sudo systemctl daemon-reload</div>
                    <div>2. sudo systemctl enable pifan.service && sudo systemctl start pifan.service</div>
                  </div>
                </div>

                {/* HARDWARE OVERLAY INFO */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-[9px] text-white/60 space-y-1 mt-2 font-sans pl-4">
                  <div className="font-bold text-white/80 uppercase tracking-widest font-mono text-[8px] mb-1">Raspberry Pi Physical Wiring Setup</div>
                  <div>• <strong>Red wire (VCC)</strong>: Connects to Pin 2 or Pin 4 (5V power rail)</div>
                  <div>• <strong>Black wire (GND)</strong>: Connects to Pin 6 or Pin 9 (Ground rail)</div>
                  <div>• <strong>Blue/Yellow (PWM Control)</strong>: Connects to Pin 12 (BCM GPIO 18, standard PWM)</div>
                  <div>• The daemon utilizes <code>gpiozero</code> to drive high frequency hardware PWM on standard models.</div>
                </div>

              </div>
            )}

          </div>

        </div>
      </DesktopWindow>
    </div>
  );
}
