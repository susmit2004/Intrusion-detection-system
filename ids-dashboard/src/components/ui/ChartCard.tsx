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
      className={cn(
        "rounded-xl border border-[#1e3a5f] bg-[#0a1628]",
        "hover:border-[#2d5286] transition-colors duration-200",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[#1e3a5f]">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Chart area */}
      <div className={cn(height, !noPadding && "px-5 py-4")}>
        {children}
      </div>
    </div>
  );
}
