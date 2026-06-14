import React, { useRef, useState, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';
import { motion } from 'motion/react';

interface DesktopWindowProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  widthClass?: string;
  heightClass?: string;
}

export default function DesktopWindow({
  title,
  isOpen,
  onClose,
  children,
  icon,
  widthClass = "max-w-2xl",
  heightClass = "auto"
}: DesktopWindowProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ scale: 0.93, opacity: 0, y: 15 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.93, opacity: 0, y: 15 }}
      transition={{ type: "spring", damping: 25, stiffness: 350 }}
      className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${widthClass} h-${heightClass} z-40 p-[1px] rounded-[40px] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden select-none`}
    >
      {/* Decorative high-contrast inner glow line */}
      <div className="absolute inset-0 rounded-[40px] border border-white/5 pointer-events-none" />

      {/* Glassy Title Bar Header */}
      <div className="flex items-center justify-between p-6 sm:p-8 bg-black/10 border-b border-white/10 cursor-grab active:cursor-grabbing rounded-t-[40px] relative">
        <div className="flex flex-col">
          <h1 className="text-lg sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2.5">
            {icon && <span className="text-teal-400">{icon}</span>}
            {title}
          </h1>
          <p className="text-[10px] sm:text-xs text-white/45 font-medium uppercase tracking-[0.2em] mt-1">Raspberry Pi Smart Thermal Monitor Dashboard</p>
        </div>

        {/* Glass Windows Controls */}
        <div className="flex items-center gap-2 self-start pt-1.5">
          <button 
            className="w-3 h-3 rounded-full bg-red-400/55 hover:bg-rose-500 transition-colors cursor-pointer"
            id={`win-minimize-${title.replace(/\s+/g, '-').toLowerCase()}`}
            title="Minimize"
          />
          <button 
            className="w-3 h-3 rounded-full bg-amber-400/55 hover:bg-yellow-500 transition-colors cursor-pointer"
            id={`win-expand-${title.replace(/\s+/g, '-').toLowerCase()}`}
            title="Expand"
          />
          <button 
            onClick={onClose}
            className="w-3 h-3 rounded-full bg-emerald-400/55 hover:bg-emerald-500 transition-colors cursor-pointer"
            id={`win-close-${title.replace(/\s+/g, '-').toLowerCase()}`}
            title="Close"
          />
        </div>
      </div>

      {/* Main Glass Screen Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 text-white select-text max-h-[75vh] scrollbar-thin scrollbar-thumb-white/15">
        {children}
      </div>
    </motion.div>
  );
}
