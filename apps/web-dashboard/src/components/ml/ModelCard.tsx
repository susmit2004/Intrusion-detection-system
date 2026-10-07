import { cn, formatMetric, formatScore } from "@/lib/utils";
import type { ModelMetrics } from "@/types";
import { TrendingUp, Target, Eye, Zap, Radio, Activity } from "lucide-react";

interface ModelCardProps {
  label: string;
  dataset: string;
  nFeatures: number;
  metrics: ModelMetrics;
  lrMetrics?: ModelMetrics;
  rfMetrics?: ModelMetrics;
  wLr: number;
  wRf: number;
  threshold: number;
  color: "blue" | "violet";
  className?: string;
}

const COLOR_MAP = {
  blue:   { hex: "var(--accent)", label: "Primary" },
  violet: { hex: "var(--color-normal)", label: "Secondary" },
};

export default function ModelCard({
  label, dataset, nFeatures,
  metrics, lrMetrics, rfMetrics,
  wLr, wRf, threshold,
  color, className,
}: ModelCardProps) {
  const c = COLOR_MAP[color];

  const kpis = [
    { icon: <TrendingUp size={13} />, label: "Accuracy",  value: formatMetric(metrics.accuracy)  },
    { icon: <Target size={13} />,     label: "Precision", value: formatMetric(metrics.precision) },
    { icon: <Eye size={13} />,        label: "Recall",    value: formatMetric(metrics.recall)    },
    { icon: <Zap size={13} />,        label: "F1 Score",  value: formatMetric(metrics.f1)        },
    { icon: <Radio size={13} />,      label: "ROC-AUC",   value: formatMetric(metrics.roc_auc)   },
    { icon: <Activity size={13} />,   label: "FN (Missed)",value: metrics.fn.toLocaleString(),  amber: true },
  ];

  return (
    <div
      className={cn("rounded-xl border overflow-hidden transition-colors", className)}
      style={{
        borderColor: `color-mix(in srgb, ${c.hex} 25%, var(--border))`,
        background: "var(--bg-card)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b"
        style={{
          borderColor: "var(--border)",
          background: `color-mix(in srgb, ${c.hex} 4%, var(--bg-elevated))`,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: c.hex }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {label}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{dataset}</p>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
            style={{
              background: `color-mix(in srgb, ${c.hex} 10%, transparent)`,
              borderColor: `color-mix(in srgb, ${c.hex} 25%, transparent)`,
              color: c.hex,
            }}
          >
            {nFeatures} features
          </span>
        </div>

        {/* Hybrid formula */}
        <div className="mt-3 text-[11px] font-mono flex flex-wrap gap-1" style={{ color: "var(--text-muted)" }}>
          <span>Hybrid = </span>
          <span style={{ color: "var(--model-lr)" }}>{wLr.toFixed(2)}×LR</span>
          <span> + </span>
          <span style={{ color: "var(--chart-orange)" }}>{wRf.toFixed(2)}×RF</span>
          <span className="ml-2">
            thr=<span style={{ color: "var(--accent)" }}>{formatScore(threshold)}</span>
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 divide-x divide-y" style={{ borderColor: "var(--border)" }}>
        {kpis.map(({ icon, label: kLabel, value, amber }) => (
          <div key={kLabel} className="px-4 py-3">
            <div
              className="flex items-center gap-1 text-[10px] uppercase tracking-wide mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              {icon}
              {kLabel}
            </div>
            <span
              className="text-base font-bold tabular-nums"
              style={{ color: amber ? "var(--color-review)" : "var(--text-primary)" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* LR vs RF sub-comparison */}
      {lrMetrics && rfMetrics && (
        <div
          className="px-5 py-3 border-t flex gap-4 text-[11px]"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <span style={{ color: "var(--model-lr)" }} className="font-semibold">LR</span>
            <span style={{ color: "var(--text-muted)" }} className="ml-1">
              Rec={formatMetric(lrMetrics.recall)} · FN={lrMetrics.fn}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--chart-orange)" }} className="font-semibold">RF</span>
            <span style={{ color: "var(--text-muted)" }} className="ml-1">
              Rec={formatMetric(rfMetrics.recall)} · FN={rfMetrics.fn}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
