import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "blue" | "violet" | "emerald" | "red" | "amber" | "cyan";
  className?: string;
  large?: boolean;
}

const ACCENT_MAP = {
  blue:    { ring: "ring-blue-500/20",   icon: "text-blue-400",    bg: "bg-blue-500/10"   },
  violet:  { ring: "ring-violet-500/20", icon: "text-violet-400",  bg: "bg-violet-500/10" },
  emerald: { ring: "ring-emerald-500/20",icon: "text-emerald-400", bg: "bg-emerald-500/10"},
  red:     { ring: "ring-red-500/20",    icon: "text-red-400",     bg: "bg-red-500/10"    },
  amber:   { ring: "ring-amber-500/20",  icon: "text-amber-400",   bg: "bg-amber-500/10"  },
  cyan:    { ring: "ring-cyan-500/20",   icon: "text-cyan-400",    bg: "bg-cyan-500/10"   },
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendLabel,
  accent = "blue",
  className,
  large = false,
}: StatCardProps) {
  const colors = ACCENT_MAP[accent];

  return (
    <div
      className={cn(
        "rounded-xl border",
        "p-4 flex flex-col gap-3 relative overflow-hidden",
        "hover:border-[#2d5286] transition-colors duration-200",
        className
      )}
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}
    >
      {/* Subtle top gradient line */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-0.5 opacity-60",
          accent === "blue"    && "bg-gradient-to-r from-transparent via-blue-500 to-transparent",
          accent === "violet"  && "bg-gradient-to-r from-transparent via-violet-500 to-transparent",
          accent === "emerald" && "bg-gradient-to-r from-transparent via-emerald-500 to-transparent",
          accent === "red"     && "bg-gradient-to-r from-transparent via-red-500 to-transparent",
          accent === "amber"   && "bg-gradient-to-r from-transparent via-amber-500 to-transparent",
          accent === "cyan"    && "bg-gradient-to-r from-transparent via-cyan-500 to-transparent",
        )}
      />

      {/* Header row */}
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider leading-none" style={{ color: "var(--text-secondary)" }}>
          {title}
        </p>
        {icon && (
          <div className={cn("p-1.5 rounded-md", colors.bg)}>
            <span className={cn("block", colors.icon)}>{icon}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span
          className={cn(
            "font-bold tabular-nums",
            large ? "text-3xl" : "text-2xl"
          )}
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
        {trend && trendLabel && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-medium mb-0.5",
              trend === "up"      && "text-emerald-400",
              trend === "down"    && "text-red-400",
              trend === "neutral" && "text-slate-400"
            )}
          >
            {trend === "up"      && <TrendingUp size={11} />}
            {trend === "down"    && <TrendingDown size={11} />}
            {trend === "neutral" && <Minus size={11} />}
            {trendLabel}
          </div>
        )}
      </div>

      {subtitle && (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      )}
    </div>
  );
}
