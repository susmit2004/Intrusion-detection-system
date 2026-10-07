import { formatScore } from "@/lib/utils";
import type { PredictionSummary } from "@/types";
import { Activity, AlertTriangle, CheckCircle, ShieldAlert, Clock } from "lucide-react";

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
  const pct = (n: number) => ((n / summary.total_events) * 100).toFixed(1) + "%";

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        <div className="flex items-center gap-2">
          <Activity size={15} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {modelLabel} — Prediction Results
          </span>
        </div>
        <div className="flex items-center gap-2">
          {processingMs && (
            <div
              className="flex items-center gap-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              <Clock size={11} />
              {processingMs}ms (estimated)
            </div>
          )}
          <span
            className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
            style={{
              background: "color-mix(in srgb, var(--color-normal) 8%, transparent)",
              borderColor: "color-mix(in srgb, var(--color-normal) 25%, transparent)",
              color: "var(--color-normal)",
            }}
          >
            Complete
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y" style={{ borderColor: "var(--border)" }}>
        {[
          { label: "Total Events",  value: summary.total_events.toLocaleString(),  icon: <Activity size={13} />,     color: "var(--text-primary)"  },
          { label: "Normal",        value: summary.normal_count.toLocaleString(),  icon: <CheckCircle size={13} />,  color: "var(--color-normal)"              },
          { label: "Attack",        value: summary.attack_count.toLocaleString(),  icon: <ShieldAlert size={13} />,  color: "var(--color-attack)"              },
          { label: "High Risk",     value: summary.high_risk.toLocaleString(),     icon: <ShieldAlert size={13} />,  color: "var(--color-attack)"              },
          { label: "Moderate Risk", value: summary.moderate_risk.toLocaleString(), icon: <AlertTriangle size={13} />,color: "var(--color-review)"              },
          { label: "Low Risk",      value: summary.low_risk.toLocaleString(),      icon: <CheckCircle size={13} />,  color: "var(--color-normal)"              },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="px-4 py-3 flex flex-col gap-1">
            <div
              className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide"
              style={{ color }}
            >
              {icon}
              {label}
            </div>
            <span className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Attack rate bar */}
      <div className="px-5 py-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
        <div
          className="flex items-center justify-between text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          <span>
            Normal: <span className="font-medium" style={{ color: "var(--color-normal)" }}>{pct(summary.normal_count)}</span>
          </span>
          <span>
            Attack: <span className="font-medium" style={{ color: "var(--color-attack)" }}>{pct(summary.attack_count)}</span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden flex" style={{ background: "var(--border)" }}>
          <div style={{ width: pct(summary.normal_count), background: "var(--color-normal)" }} className="h-full rounded-l-full" />
          <div style={{ width: pct(summary.attack_count), background: "var(--color-attack)" }} className="h-full rounded-r-full" />
        </div>
      </div>

      {/* Config summary */}
      {(hybridWeight || threshold) && (
        <div
          className="px-5 py-3 border-t flex flex-wrap gap-4 text-[11px]"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {hybridWeight && (
            <span>
              Hybrid:{" "}
              <span className="font-mono" style={{ color: "var(--model-lr)" }}>w_LR={hybridWeight.w_lr.toFixed(2)}</span>
              {" + "}
              <span className="font-mono" style={{ color: "var(--chart-orange)" }}>w_RF={hybridWeight.w_rf.toFixed(2)}</span>
            </span>
          )}
          {threshold && (
            <span>
              Threshold:{" "}
              <span className="font-mono" style={{ color: "var(--accent)" }}>{formatScore(threshold)}</span>
            </span>
          )}
          <span>
            Detection rate:{" "}
            <span className="font-semibold" style={{ color: "var(--color-normal)" }}>
              {summary.detection_rate.toFixed(2)}%
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
