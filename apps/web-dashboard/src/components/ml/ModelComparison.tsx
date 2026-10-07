"use client";

import { cn, formatMetric } from "@/lib/utils";
import type { ModelMetrics } from "@/types";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber, fmtPct } from "@/lib/chartHelpers";

interface ModelComparisonProps {
  primaryHybrid:   ModelMetrics;
  secondaryHybrid: ModelMetrics;
  className?: string;
}

const METRICS: { key: keyof ModelMetrics; label: string }[] = [
  { key: "accuracy",  label: "Accuracy"  },
  { key: "precision", label: "Precision" },
  { key: "recall",    label: "Recall"    },
  { key: "f1",        label: "F1"        },
  { key: "roc_auc",   label: "AUC"       },
];

export default function ModelComparison({
  primaryHybrid,
  secondaryHybrid,
  className,
}: ModelComparisonProps) {
  // Radar data
  const radarData = METRICS.map(({ key, label }) => ({
    metric: label,
    Primary:   +(primaryHybrid[key] as number * 100).toFixed(2),
    Secondary: +(secondaryHybrid[key] as number * 100).toFixed(2),
  }));

  // Bar data
  const barData = METRICS.map(({ key, label }) => ({
    name: label,
    Primary:   +(primaryHybrid[key] as number * 100).toFixed(2),
    Secondary: +(secondaryHybrid[key] as number * 100).toFixed(2),
  }));

  // Winner per metric
  const winners = METRICS.map(({ key, label }) => {
    const pv = primaryHybrid[key] as number;
    const sv = secondaryHybrid[key] as number;
    return {
      label,
      pv,
      sv,
      winner: pv > sv ? "primary" : sv > pv ? "secondary" : "tie",
    };
  });

  // FN comparison
  const fnBar = [
    { name: "Logistic\nRegression", Primary: 437, Secondary: 1371 },
    { name: "Random\nForest",       Primary: 51,  Secondary: 20   },
    { name: "Hybrid\nModel",        Primary: 66,  Secondary: 20   },
  ];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Metric winner table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Hybrid Model — Head-to-Head Metrics</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>On respective independent test sets</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Metric</th>
                <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Primary</th>
                <th className="px-4 py-2.5 text-right font-semibold uppercase tracking-wider" style={{ color: "var(--color-normal)" }}>Secondary</th>
                <th className="px-4 py-2.5 text-center font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Higher</th>
              </tr>
            </thead>
            <tbody>
              {winners.map(({ label, pv, sv, winner }, i) => (
                <tr key={label}
                  className="border-b"
                  style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-card-alt)", borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>{label}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: winner === "primary" ? "var(--accent)" : "var(--text-muted)" }}>
                    {formatMetric(pv)}{winner === "primary" && " ◀"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: winner === "secondary" ? "var(--color-normal)" : "var(--text-muted)" }}>
                    {formatMetric(sv)}{winner === "secondary" && " ◀"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                      style={
                        winner === "primary"
                          ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)" }
                          : winner === "secondary"
                          ? { background: "color-mix(in srgb, var(--color-normal) 10%, transparent)", borderColor: "color-mix(in srgb, var(--color-normal) 25%, transparent)", color: "var(--color-normal)" }
                          : { background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--text-muted)" }
                      }
                    >
                      {winner === "tie" ? "Tie" : winner.charAt(0).toUpperCase() + winner.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {[
                { label: "TP",  p: primaryHybrid.tp,  s: secondaryHybrid.tp  },
                { label: "TN",  p: primaryHybrid.tn,  s: secondaryHybrid.tn  },
                { label: "FP",  p: primaryHybrid.fp,  s: secondaryHybrid.fp  },
                { label: "FN (Missed Attacks)", p: primaryHybrid.fn, s: secondaryHybrid.fn },
              ].map(({ label, p, s }, i) => (
                <tr key={label}
                  className="border-b"
                  style={{ background: (winners.length + i) % 2 === 0 ? "var(--bg-card)" : "var(--bg-card-alt)", borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}
                >
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>{label}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: label.includes("FN") || label === "FP" ? "var(--color-review)" : "var(--text-secondary)" }}>{p.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: label.includes("FN") || label === "FP" ? "var(--color-review)" : "var(--text-secondary)" }}>{s.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-center" style={{ color: "var(--text-muted)" }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar */}
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Performance Radar</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={CHART_COLORS.grid} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <Radar name="Primary"   dataKey="Primary"   stroke={CHART_COLORS.primary}   fill={CHART_COLORS.primary}   fillOpacity={0.15} strokeWidth={2} />
              <Radar name="Secondary" dataKey="Secondary" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.15} strokeWidth={2} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} formatter={fmtPct} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar */}
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Metric Comparison (% scale)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <YAxis domain={[80, 101]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} formatter={fmtPct} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
              <Bar dataKey="Primary"   fill={CHART_COLORS.primary}   radius={[3, 3, 0, 0]} />
              <Bar dataKey="Secondary" fill={CHART_COLORS.secondary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FN comparison bar */}
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Missed Attacks (FN) — Lower is Better</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>In SOC operations, every FN is an undetected attack.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={fnBar} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
            <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} formatter={fmtNumber} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Bar dataKey="Primary"   fill={CHART_COLORS.primary}   radius={[3, 3, 0, 0]} />
            <Bar dataKey="Secondary" fill={CHART_COLORS.secondary} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
