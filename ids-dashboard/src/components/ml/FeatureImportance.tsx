"use client";

import { cn } from "@/lib/utils";
import type { FeatureImportanceItem } from "@/types";

interface FeatureImportanceProps {
  items: FeatureImportanceItem[];
  title?: string;
  maxItems?: number;
  className?: string;
}

// Color scale from high to low importance
const getBarColor = (rank: number, total: number): string => {
  const ratio = 1 - (rank - 1) / total;
  if (ratio > 0.8)  return "from-violet-500 to-blue-500";
  if (ratio > 0.6)  return "from-blue-500 to-cyan-500";
  if (ratio > 0.4)  return "from-cyan-500 to-teal-500";
  if (ratio > 0.2)  return "from-teal-500 to-emerald-500";
  return "from-emerald-500 to-emerald-600";
};

export default function FeatureImportance({
  items,
  title = "RF Feature Importance",
  maxItems = 12,
  className,
}: FeatureImportanceProps) {
  const sorted = [...items]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxItems);

  const maxImp = sorted[0]?.importance ?? 1;

  return (
    <div className={cn("rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Gini Importance
        </span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((item, i) => {
          const widthPct = (item.importance / maxImp) * 100;
          return (
            <div key={item.feature} className="flex items-center gap-3">
              {/* Rank */}
              <span className="w-5 text-[11px] text-slate-600 font-mono text-right shrink-0">
                {item.rank}
              </span>

              {/* Feature name */}
              <span className="w-48 text-xs text-slate-300 truncate shrink-0 font-medium">
                {item.feature}
              </span>

              {/* Bar */}
              <div className="flex-1 h-3 rounded-full bg-[#1e3a5f] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r transition-all duration-500",
                    getBarColor(item.rank, sorted.length)
                  )}
                  style={{ width: `${widthPct}%` }}
                />
              </div>

              {/* Value */}
              <span className="w-14 text-[11px] text-slate-400 font-mono text-right shrink-0">
                {(item.importance * 100).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] text-slate-600 border-t border-[#1e3a5f] pt-3">
        Higher score = feature is more important for detecting attacks.
        Computed using Random Forest Gini impurity (mean decrease in impurity).
      </p>
    </div>
  );
}
