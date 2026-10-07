"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Shield,
  Database,
  GitCompare,
  BarChart3,
  Activity,
  Cpu,
  Settings,
  ChevronRight,
  Wifi,
  X,
  GitMerge,
  House,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home",             href: "/home",          icon: <House size={16} /> },
  { label: "Overview",          href: "/overview",        icon: <LayoutDashboard size={16} /> },
  { label: "Primary Model",     href: "/primary-model",   icon: <Shield size={16} />,        badge: "22 feat" },
  { label: "Secondary Model",   href: "/secondary-model", icon: <Database size={16} />,      badge: "12 feat" },
  { label: "Ensemble Analysis", href: "/ensemble",        icon: <GitMerge size={16} />,      badge: "NEW" },
  { label: "Model Comparison",  href: "/comparison",      icon: <GitCompare size={16} /> },
  { label: "Analysis",          href: "/analysis",        icon: <BarChart3 size={16} /> },
  { label: "Performance",       href: "/performance",     icon: <Activity size={16} /> },
  { label: "Results",           href: "/results",         icon: <Cpu size={16} /> },
  { label: "Configuration",     href: "/configuration",   icon: <Settings size={16} /> },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-full w-64 flex flex-col",
          "border-r",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:static lg:z-auto"
        )}
        style={{ background: "var(--bg-base)", borderColor: "var(--border-color)" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Wifi size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">IDS Dashboard</p>
              <p className="text-[10px] text-slate-500 mt-0.5">SOC Analytics v1.0</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-slate-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Model status indicators */}
        <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              Model Status
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live" />
            <span className="text-xs text-slate-400">Primary Model</span>
            <span className="ml-auto text-[10px] text-emerald-400 font-medium">Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-live" />
            <span className="text-xs text-slate-400">Secondary Model</span>
            <span className="ml-auto text-[10px] text-emerald-400 font-medium">Ready</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest px-2 mb-2 font-semibold">
            Navigation
          </p>
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                  "transition-all duration-150 group relative border",
                  active
                    ? "border"
                    : "border-transparent hover:bg-white/5"
                )}
                style={active ? {
                  background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                  color: "var(--accent)",
                } : {
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  className="transition-colors"
                  style={active ? { color: "var(--accent)" } : { color: "var(--text-secondary)" }}
                >
                  {item.icon}
                </span>
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded font-mono",
                    item.badge === "NEW"
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-slate-700 text-slate-400"
                  )}>
                    {item.badge}
                  </span>
                )}
                {active && (
                  <ChevronRight size={12} style={{ color: "var(--accent)" }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t" style={{ borderColor: "var(--border-color)" }}>
          <div className="rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 p-3">
            <p className="text-xs font-semibold text-blue-300">CIC-IDS-2017</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Hybrid ML Framework · MCA Project
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
