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
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e3a5f] bg-gradient-to-r from-blue-500/5 to-violet-500/5">
          <p className="text-sm font-semibold text-white">Hybrid Model — Head-to-Head Metrics</p>
          <p className="text-[11px] text-slate-500 mt-0.5">On respective unseen test sets</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f1f3d] border-b border-[#1e3a5f]">
                <th className="px-4 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">Metric</th>
                <th className="px-4 py-2.5 text-right font-semibold text-blue-400 uppercase tracking-wider">Primary</th>
                <th className="px-4 py-2.5 text-right font-semibold text-violet-400 uppercase tracking-wider">Secondary</th>
                <th className="px-4 py-2.5 text-center font-semibold text-slate-400 uppercase tracking-wider">Winner</th>
              </tr>
            </thead>
            <tbody>
              {winners.map(({ label, pv, sv, winner }, i) => (
                <tr key={label}
                  className={cn(
                    "border-b border-[#1e3a5f]/50",
                    i % 2 === 0 ? "bg-[#0a1628]" : "bg-[#0c1a30]"
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-300">{label}</td>
                  <td className={cn(
                    "px-4 py-2.5 text-right font-mono font-semibold",
                    winner === "primary" ? "text-blue-400" : "text-slate-400"
                  )}>
                    {formatMetric(pv)}
                    {winner === "primary" && " ◀"}
                  </td>
                  <td className={cn(
                    "px-4 py-2.5 text-right font-mono font-semibold",
                    winner === "secondary" ? "text-violet-400" : "text-slate-400"
                  )}>
                    {formatMetric(sv)}
                    {winner === "secondary" && " ◀"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                      winner === "primary"
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        : winner === "secondary"
                        ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                        : "bg-slate-500/10 border-slate-500/20 text-slate-400"
                    )}>
                      {winner === "tie" ? "Tie" : winner.charAt(0).toUpperCase() + winner.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Confusion rows */}
              {[
                { label: "TP",  p: primaryHybrid.tp,  s: secondaryHybrid.tp  },
                { label: "TN",  p: primaryHybrid.tn,  s: secondaryHybrid.tn  },
                { label: "FP",  p: primaryHybrid.fp,  s: secondaryHybrid.fp  },
                { label: "FN (Missed Attacks)", p: primaryHybrid.fn, s: secondaryHybrid.fn },
              ].map(({ label, p, s }, i) => (
                <tr key={label}
                  className={cn(
                    "border-b border-[#1e3a5f]/50",
                    (winners.length + i) % 2 === 0 ? "bg-[#0a1628]" : "bg-[#0c1a30]"
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-400">{label}</td>
                  <td className={cn(
                    "px-4 py-2.5 text-right font-mono",
                    label.includes("FN") || label === "FP" ? "text-amber-400" : "text-slate-300"
                  )}>
                    {p.toLocaleString()}
                  </td>
                  <td className={cn(
                    "px-4 py-2.5 text-right font-mono",
                    label.includes("FN") || label === "FP" ? "text-amber-400" : "text-slate-300"
                  )}>
                    {s.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-600">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar */}
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
          <p className="text-sm font-semibold text-white mb-4">Performance Radar</p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={CHART_COLORS.grid} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <Radar name="Primary"   dataKey="Primary"   stroke={CHART_COLORS.primary}   fill={CHART_COLORS.primary}   fillOpacity={0.15} strokeWidth={2} />
              <Radar name="Secondary" dataKey="Secondary" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.15} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
                formatter={fmtPct}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Bar */}
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
          <p className="text-sm font-semibold text-white mb-4">Metric Comparison (% scale)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <YAxis domain={[80, 101]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
                formatter={fmtPct}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Primary"   fill={CHART_COLORS.primary}   radius={[3, 3, 0, 0]} />
              <Bar dataKey="Secondary" fill={CHART_COLORS.secondary} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FN comparison bar */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-1">Missed Attacks (FN) — Lower is Better</p>
        <p className="text-[11px] text-slate-500 mb-4">In SOC operations, every FN is an undetected attack.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={fnBar} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
            <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
              formatter={fmtNumber}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Primary"   fill={CHART_COLORS.primary}   radius={[3, 3, 0, 0]} />
            <Bar dataKey="Secondary" fill={CHART_COLORS.secondary} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
