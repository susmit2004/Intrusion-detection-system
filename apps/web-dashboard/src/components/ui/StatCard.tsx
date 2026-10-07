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

// Map legacy accent names to new palette hex values
const ACCENT_COLOR: Record<string, string> = {
  blue:    "var(--accent)",
  violet:  "var(--color-normal)",
  emerald: "var(--color-normal)",
  red:     "var(--color-attack)",
  amber:   "var(--color-review)",
  cyan:    "var(--accent)",
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
  const color = ACCENT_COLOR[accent] ?? "var(--accent)";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-3 relative overflow-hidden transition-colors duration-200",
        className
      )}
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-card)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <p
          className="text-xs font-medium uppercase tracking-wider leading-none"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </p>
        {icon && (
          <div
            className="p-1.5 rounded-md"
            style={{ background: `${color}18`, color }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-end gap-2">
        <span
          className={cn("font-bold tabular-nums", large ? "text-3xl" : "text-2xl")}
          style={{ color: "var(--text-primary)" }}
        >
          {value}
        </span>
        {trend && trendLabel && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-medium mb-0.5",
              trend === "up" && "text-[var(--color-normal)]",
              trend === "down" && "text-[var(--color-attack)]",
              trend === "neutral" && "text-[var(--text-secondary)]"
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
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
