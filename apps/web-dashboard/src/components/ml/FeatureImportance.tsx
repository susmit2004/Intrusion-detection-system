"use client";

import { cn } from "@/lib/utils";
import type { FeatureImportanceItem } from "@/types";

interface FeatureImportanceProps {
  items: FeatureImportanceItem[];
  title?: string;
  maxItems?: number;
  className?: string;
}

// Opacity scale from full (top) to 50% (bottom)
const getBarOpacity = (rank: number, total: number): number =>
  Math.max(0.5, 1 - ((rank - 1) / total) * 0.5);

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
    <div
      className={cn("rounded-xl border p-5", className)}
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          Gini Importance
        </span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((item) => {
          const widthPct = (item.importance / maxImp) * 100;
          const opacity = getBarOpacity(item.rank, sorted.length);
          return (
            <div key={item.feature} className="flex items-center gap-3">
              {/* Rank */}
              <span
                className="w-5 text-[11px] font-mono text-right shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {item.rank}
              </span>

              {/* Feature name */}
              <span
                className="w-44 text-xs truncate shrink-0 font-medium"
                style={{ color: "var(--text-secondary)" }}
                title={item.feature}
              >
                {item.feature}
              </span>

              {/* Bar track */}
              <div
                className="flex-1 h-3 rounded-full overflow-hidden"
                style={{ background: "var(--border)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${widthPct}%`, background: "var(--accent)", opacity }}
                />
              </div>

              {/* Value */}
              <span
                className="w-14 text-[11px] font-mono text-right shrink-0"
                style={{ color: "var(--text-secondary)" }}
              >
                {(item.importance * 100).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      <p
        className="mt-4 text-[10px] border-t pt-3"
        style={{ color: "var(--text-muted)", borderColor: "var(--border)" }}
      >
        Higher score = feature is more important for detecting attacks.
        Computed using Random Forest Gini impurity (mean decrease in impurity).
      </p>
    </div>
  );
}
