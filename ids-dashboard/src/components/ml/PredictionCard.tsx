import { cn, formatScore, formatPercent } from "@/lib/utils";
import { RiskBadge, PredictionBadge } from "@/components/ui/RiskBadge";
import type { PredictionSummary } from "@/types";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Clock,
} from "lucide-react";

interface PredictionCardProps {
  summary: PredictionSummary;
  modelLabel: string;
  processingMs?: number;
  hybridWeight?: { w_lr: number; w_rf: number };
  threshold?: number;
}

export default function PredictionCard({
  summary,
  modelLabel,
  processingMs,
  hybridWeight,
  threshold,
}: PredictionCardProps) {
  const pct = (n: number) =>
    ((n / summary.total_events) * 100).toFixed(1) + "%";

  return (
    <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1e3a5f] flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-violet-500/5">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">{modelLabel} — Prediction Results</span>
        </div>
        <div className="flex items-center gap-2">
          {processingMs && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Clock size={11} />
              {processingMs}ms
            </div>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            Complete
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-[#1e3a5f]">
        {[
          { label: "Total Events",    value: summary.total_events.toLocaleString(), icon: <Activity size={13} />,     color: "text-blue-400"    },
          { label: "Normal",          value: summary.normal_count.toLocaleString(), icon: <CheckCircle size={13} />,  color: "text-emerald-400" },
          { label: "Attack",          value: summary.attack_count.toLocaleString(), icon: <ShieldAlert size={13} />,  color: "text-red-400"     },
          { label: "High Risk",       value: summary.high_risk.toLocaleString(),    icon: <ShieldAlert size={13} />,  color: "text-red-400"     },
          { label: "Moderate Risk",   value: summary.moderate_risk.toLocaleString(),icon: <AlertTriangle size={13} />,color: "text-amber-400"   },
          { label: "Low Risk",        value: summary.low_risk.toLocaleString(),     icon: <CheckCircle size={13} />,  color: "text-emerald-400" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="px-4 py-3 flex flex-col gap-1">
            <div className={cn("flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide", color)}>
              {icon}
              {label}
            </div>
            <span className="text-lg font-bold text-white tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* Attack rate bar */}
      <div className="px-5 py-3 border-t border-[#1e3a5f] space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Normal:{" "}
            <span className="text-emerald-400 font-medium">
              {pct(summary.normal_count)}
            </span>
          </span>
          <span>
            Attack:{" "}
            <span className="text-red-400 font-medium">
              {pct(summary.attack_count)}
            </span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#1e3a5f] overflow-hidden flex">
          <div
            style={{ width: pct(summary.normal_count) }}
            className="h-full bg-emerald-500 rounded-l-full"
          />
          <div
            style={{ width: pct(summary.attack_count) }}
            className="h-full bg-red-500 rounded-r-full"
          />
        </div>
      </div>

      {/* Hybrid config summary */}
      {(hybridWeight || threshold) && (
        <div className="px-5 py-3 border-t border-[#1e3a5f] flex flex-wrap gap-4 text-[11px] text-slate-500">
          {hybridWeight && (
            <>
              <span>
                Hybrid:{" "}
                <span className="text-sky-400 font-mono">
                  w_LR={hybridWeight.w_lr.toFixed(2)}
                </span>{" "}
                +{" "}
                <span className="text-orange-400 font-mono">
                  w_RF={hybridWeight.w_rf.toFixed(2)}
                </span>
              </span>
            </>
          )}
          {threshold && (
            <span>
              Threshold:{" "}
              <span className="text-violet-400 font-mono">{formatScore(threshold)}</span>
            </span>
          )}
          <span>
            Detection rate:{" "}
            <span className="text-emerald-400 font-semibold">
              {summary.detection_rate.toFixed(2)}%
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
