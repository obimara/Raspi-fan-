import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface DaemonTerminalProps {
  logs: string[];
  onClearLogs: () => void;
}

export default function DaemonTerminal({ logs, onClearLogs }: DaemonTerminalProps) {
  const [filter, setFilter] = useState('');
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll down when new logs appear
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => 
    log.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[220px] bg-black/40 rounded-3xl border border-white/5 shadow-inner overflow-hidden font-mono text-xs text-white/90">
      
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] text-white/60 font-bold tracking-wider">DAEMON CLIENT OVERRIDE LOGS</span>
        </div>
        
        {/* Actions inside header */}
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Filter..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-black/40 text-white/80 border border-white/10 rounded-lg px-2.5 py-1 text-[9px] w-24 focus:outline-hidden focus:border-white/30 font-mono"
            id="log-filter-input"
          />
          <button 
            onClick={onClearLogs}
            className="text-[9px] text-white/45 hover:text-rose-400 cursor-pointer transition-colors"
            id="clear-logs-btn"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Body Screen */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
        {filteredLogs.length === 0 ? (
          <div className="text-white/30 text-[10px] py-4 text-center">
            -- No matching system daemon trace lines --
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            // Differentiate server, RPi log or speed adjustments visually
            let colorClass = "text-white/60";
            if (log.includes("[ERROR]") || log.includes("failed")) {
              colorClass = "text-rose-300 font-medium";
            } else if (log.includes("[CONNECTION WARN]") || log.includes("unreachable")) {
              colorClass = "text-amber-300";
            } else if (log.includes("PI:")) {
              colorClass = "text-teal-300";
            } else if (log.includes("Control configuration updated") || log.includes("Mode changed")) {
              colorClass = "text-indigo-300";
            } else if (log.includes("System initialized")) {
              colorClass = "text-emerald-300 font-bold";
            }

            return (
              <div key={idx} className={`leading-relaxed break-all text-[10px] ${colorClass}`}>
                <span className="text-white/20 select-none mr-1.5">$</span>
                {log}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Mini Status HUD Footer */}
      <div className="px-4 py-1.5 bg-black/20 border-t border-white/5 flex justify-between items-center text-[8px] text-white/40 select-none">
        <span>Channel: remote_gpio_telemetry</span>
        <span>Buffer: {logs.length} entries</span>
      </div>
    </div>
  );
}
