import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "blue" | "violet" | "emerald" | "amber";
  children?: React.ReactNode;
}

const BADGE_COLORS = {
  blue:    "bg-blue-500/10 border-blue-500/20 text-blue-400",
  violet:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  amber:   "bg-amber-500/10 border-amber-500/20 text-amber-400",
};

export default function PageHeader({
  title,
  subtitle,
  badge,
  badgeColor = "blue",
  children,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex flex-col gap-1.5">
        {badge && (
          <span
            className={cn(
              "self-start text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border",
              BADGE_COLORS[badgeColor]
            )}
          >
            {badge}
          </span>
        )}
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
