"use client";

import { Menu, Bell, AlertTriangle, Info } from "lucide-react";
import { isMockMode } from "@/services/apiService";

interface NavbarProps {
  onMenuClick: () => void;
  title: string;
  subtitle?: string;
}

export default function Navbar({ onMenuClick, title, subtitle }: NavbarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 lg:px-6 border-b border-[#1e3a5f] bg-[#020b18]/80 backdrop-blur-sm sticky top-0 z-20">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">{title}</h1>
          {subtitle && (
            <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: status badges + bell */}
      <div className="flex items-center gap-3">
        {isMockMode && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Info size={11} className="text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">Mock Mode</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline">
            Live
          </span>
        </div>
        <button className="relative p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
          <Bell size={16} />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">SOC</span>
        </div>
      </div>
    </header>
  );
}
