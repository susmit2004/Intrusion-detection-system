import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  height?: string;
  noPadding?: boolean;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  className,
  action,
  height = "h-64",
  noPadding = false,
}: ChartCardProps) {
  return (
    <div
      className={cn("rounded-xl border transition-colors duration-200", className)}
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-5 pt-4 pb-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Chart area */}
      <div className={cn(height, !noPadding && "px-5 py-4")}>{children}</div>
    </div>
  );
}
