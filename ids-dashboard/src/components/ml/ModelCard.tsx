import { cn, formatMetric, formatScore } from "@/lib/utils";
import type { ModelMetrics } from "@/types";
import { TrendingUp, Target, Eye, Zap, Radio, Activity } from "lucide-react";

interface ModelCardProps {
  label: string;
  dataset: string;
  nFeatures: number;
  metrics: ModelMetrics;        // "Hybrid Model" row
  lrMetrics?: ModelMetrics;
  rfMetrics?: ModelMetrics;
  wLr: number;
  wRf: number;
  threshold: number;
  color: "blue" | "violet";
  className?: string;
}

const COLOR_MAP = {
  blue:   { ring: "border-blue-500/30",   badge: "bg-blue-500/10 text-blue-400",   dot: "bg-blue-400"   },
  violet: { ring: "border-violet-500/30", badge: "bg-violet-500/10 text-violet-400", dot: "bg-violet-400" },
};

export default function ModelCard({
  label, dataset, nFeatures,
  metrics, lrMetrics, rfMetrics,
  wLr, wRf, threshold,
  color, className,
}: ModelCardProps) {
  const c = COLOR_MAP[color];

  const kpis = [
    { icon: <TrendingUp size={13} />, label: "Accuracy",  value: formatMetric(metrics.accuracy),  color: "text-white" },
    { icon: <Target size={13} />,     label: "Precision", value: formatMetric(metrics.precision), color: "text-white" },
    { icon: <Eye size={13} />,        label: "Recall",    value: formatMetric(metrics.recall),    color: "text-white" },
    { icon: <Zap size={13} />,        label: "F1 Score",  value: formatMetric(metrics.f1),        color: "text-white" },
    { icon: <Radio size={13} />,      label: "ROC-AUC",   value: formatMetric(metrics.roc_auc),   color: "text-white" },
    { icon: <Activity size={13} />,   label: "FN (Missed)",value: metrics.fn.toLocaleString(),    color: "text-amber-400" },
  ];

  return (
    <div className={cn(
      "rounded-xl border bg-[#0a1628] overflow-hidden hover:border-opacity-60 transition-colors",
      c.ring, className
    )}>
      {/* Header */}
      <div className={cn(
        "px-5 py-4 border-b border-[#1e3a5f]",
        color === "blue"
          ? "bg-gradient-to-r from-blue-500/5 to-transparent"
          : "bg-gradient-to-r from-violet-500/5 to-transparent"
      )}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("w-2 h-2 rounded-full", c.dot)} />
              <span className="text-sm font-bold text-white">{label}</span>
            </div>
            <p className="text-[11px] text-slate-500">{dataset}</p>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", c.badge)}>
            {nFeatures} features
          </span>
        </div>

        {/* Hybrid formula */}
        <div className="mt-3 text-[11px] text-slate-500 font-mono flex flex-wrap gap-1">
          <span>Hybrid = </span>
          <span className="text-sky-400">{wLr.toFixed(2)}×LR</span>
          <span> + </span>
          <span className="text-orange-400">{wRf.toFixed(2)}×RF</span>
          <span className="ml-2">
            thr=<span className="text-violet-400">{formatScore(threshold)}</span>
          </span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 divide-x divide-y divide-[#1e3a5f]">
        {kpis.map(({ icon, label: kLabel, value, color: kColor }) => (
          <div key={kLabel} className="px-4 py-3">
            <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wide mb-1">
              <span className="text-slate-600">{icon}</span>
              {kLabel}
            </div>
            <span className={cn("text-base font-bold tabular-nums", kColor)}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* LR vs RF sub-comparison */}
      {lrMetrics && rfMetrics && (
        <div className="px-5 py-3 border-t border-[#1e3a5f] flex gap-4 text-[11px]">
          <div>
            <span className="text-sky-400 font-semibold">LR</span>
            <span className="text-slate-500 ml-1">
              Rec={formatMetric(lrMetrics.recall)} · FN={lrMetrics.fn}
            </span>
          </div>
          <div>
            <span className="text-orange-400 font-semibold">RF</span>
            <span className="text-slate-500 ml-1">
              Rec={formatMetric(rfMetrics.recall)} · FN={rfMetrics.fn}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
