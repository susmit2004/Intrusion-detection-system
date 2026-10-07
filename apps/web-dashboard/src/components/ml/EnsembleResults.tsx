"use client";

import { formatScore, downloadCSV } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";
import type { EnsembleApiResponse, EnsembleRowResult } from "@/lib/ensembleData";
import type { Column } from "@/components/ui/DataTable";
import DataTable from "@/components/ui/DataTable";
import ChartCard from "@/components/ui/ChartCard";
import { RiskBadge, PredictionBadge } from "@/components/ui/RiskBadge";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
  BarChart, Bar, Cell,
} from "recharts";
import { CHART_COLORS } from "@/lib/utils";
import { Download, AlertTriangle, GitMerge } from "lucide-react";

interface Props {
  result: EnsembleApiResponse;
}

// Columns for the results table
const COLS: Column<EnsembleRowResult>[] = [
  { key: "row_index",       header: "#",           className: "w-8 text-[var(--text-muted)]" },
  { key: "primary_score",   header: "Primary",     sortable: true, render: (r) => (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px]" style={{ color: "var(--accent)" }}>{formatScore(r.primary_score)}</span>
      <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${r.primary_score * 100}%`, background: "var(--accent)" }} />
      </div>
    </div>
  )},
  { key: "secondary_score", header: "Secondary",   sortable: true, render: (r) => (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px]" style={{ color: "var(--color-normal)" }}>{formatScore(r.secondary_score)}</span>
      <div className="w-10 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
        <div className="h-full rounded-full" style={{ width: `${r.secondary_score * 100}%`, background: "var(--color-normal)" }} />
      </div>
    </div>
  )},
  { key: "ensemble_score",  header: "Ensemble ▼",  sortable: true, render: (r) => (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>{formatScore(r.ensemble_score)}</span>
      <div className="w-14 h-2 rounded-full" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${r.ensemble_score * 100}%`,
            background: r.ensemble_score >= 0.70 ? "var(--color-attack)" : r.ensemble_score >= 0.40 ? "var(--color-review)" : "var(--color-normal)",
          }}
        />
      </div>
    </div>
  )},
  { key: "primary_pred",    header: "Prim. Pred",  render: (r) => (
    <span className="text-[11px] font-medium" style={{ color: r.primary_pred === "Attack" ? "var(--color-attack)" : "var(--color-normal)" }}>{r.primary_pred}</span>
  )},
  { key: "secondary_pred",  header: "Sec. Pred",   render: (r) => (
    <span className="text-[11px] font-medium" style={{ color: r.secondary_pred === "Attack" ? "var(--color-attack)" : "var(--color-normal)" }}>{r.secondary_pred}</span>
  )},
  { key: "final_prediction",header: "Final",       render: (r) => <PredictionBadge prediction={r.final_prediction} size="sm" /> },
  { key: "risk_level",      header: "Risk Level",  render: (r) => <RiskBadge level={r.risk_level} size="sm" /> },
  { key: "disagreement",    header: "⚠ Disagree",  render: (r) => r.disagreement ? (
    <span className="text-[11px] text-[var(--color-review)] font-semibold flex items-center gap-1">
      <AlertTriangle size={11} /> Yes
    </span>
  ) : (
    <span className="text-[11px] text-[var(--text-muted)]">—</span>
  )},
];

export default function EnsembleResults({ result }: Props) {
  const { summary, rows, errors, processing_ms } = result;

  // Scatter data: primary vs secondary score, coloured by final prediction
  const scatterData = rows.map((r) => ({
    x: r.primary_score,
    y: r.secondary_score,
    z: r.ensemble_score,
    prediction: r.final_prediction,
    disagreement: r.disagreement,
    risk: r.risk_level,
  }));
  const attackPts  = scatterData.filter((d) => d.prediction === "Attack");
  const normalPts  = scatterData.filter((d) => d.prediction === "Normal");
  const disagreePts= scatterData.filter((d) => d.disagreement);

  // Risk bar data
  const riskBar = [
    { name: "High Risk",     value: summary.high_risk,     color: CHART_COLORS.high     },
    { name: "Moderate Risk", value: summary.moderate_risk, color: CHART_COLORS.moderate },
    { name: "Low Risk",      value: summary.low_risk,       color: CHART_COLORS.low      },
  ];

  const handleExport = () => {
    downloadCSV(
      rows.map((r) => ({
        row_index:        r.row_index,
        primary_score:    r.primary_score,
        secondary_score:  r.secondary_score,
        ensemble_score:   r.ensemble_score,
        primary_pred:     r.primary_pred,
        secondary_pred:   r.secondary_pred,
        final_prediction: r.final_prediction,
        risk_level:       r.risk_level,
        disagreement:     r.disagreement,
      })),
      "ensemble_predictions.csv"
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary banner */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
          <div className="flex items-center gap-2">
            <GitMerge size={15} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Ensemble Analysis Results</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{processing_ms}ms</span>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors"
              style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", color: "var(--accent)" }}
            >
              <Download size={12} /> Export CSV
            </button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y" style={{ borderColor: "var(--border)" }}>
          {[
            { label: "Total Rows",    value: summary.total_rows.toLocaleString(),    color: "var(--text-primary)" },
            { label: "Normal",        value: summary.normal_count.toLocaleString(),  color: "var(--color-normal)" },
            { label: "Attack",        value: summary.attack_count.toLocaleString(),  color: "var(--color-attack)" },
            { label: "High Risk",     value: summary.high_risk.toLocaleString(),     color: "var(--color-attack)" },
            { label: "Moderate Risk", value: summary.moderate_risk.toLocaleString(), color: "var(--color-review)" },
            { label: "Low Risk",      value: summary.low_risk.toLocaleString(),      color: "var(--color-normal)" },
            { label: "Disagreements", value: summary.disagreements.toLocaleString(), color: "var(--color-review)" },
            { label: "Skipped Rows",  value: summary.skipped_rows.toLocaleString(),  color: "var(--text-secondary)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Attack rate bar */}
        <div className="px-5 py-3 border-t space-y-1.5" style={{ borderColor: "var(--border)" }}>
          <div className="flex justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span>Normal: <span style={{ color: "var(--color-normal)" }} className="font-medium">{(100 - summary.attack_rate_pct).toFixed(1)}%</span></span>
            <span>Weights: <span className="font-mono" style={{ color: "var(--accent)" }}>w_pri={summary.w_primary.toFixed(2)}</span> + <span className="font-mono" style={{ color: "var(--color-normal)" }}>w_sec={summary.w_secondary.toFixed(2)}</span></span>
            <span>Attack: <span style={{ color: "var(--color-attack)" }} className="font-medium">{summary.attack_rate_pct.toFixed(1)}%</span></span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="rounded-l-full" style={{ width: `${100 - summary.attack_rate_pct}%`, background: "var(--color-normal)" }} />
            <div className="rounded-r-full" style={{ width: `${summary.attack_rate_pct}%`, background: "var(--color-attack)" }} />
          </div>
        </div>
      </div>

      {/* Warnings */}
      {errors.map((e, i) => (
        <div key={i} className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle size={13} className="text-[var(--color-review)] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[var(--color-review)]">{e}</p>
        </div>
      ))}

      {/* Disagreement insight */}
      {summary.disagreements > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <AlertTriangle size={15} className="text-[var(--color-review)] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-[var(--color-review)] mb-0.5">
              Model Disagreement: {summary.disagreements} row{summary.disagreements !== 1 ? "s" : ""}
            </p>
            <p className="text-[11px] text-[var(--color-review)] leading-relaxed">
              These rows received different binary predictions from the Primary and Secondary models.
              The ensemble score (weighted average) determines the final result.
              Disagreements often indicate borderline traffic that neither model is fully confident about.
              For High-Risk disagreements, manual analyst review is recommended.
            </p>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scatter: primary vs secondary score */}
        <ChartCard
          title="Primary vs Secondary Score"
          subtitle="Each dot = one row. Disagreements shown separately."
          height="h-72"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="x" type="number" domain={[0, 1]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} label={{ value: "Primary Score", fill: CHART_COLORS.text, fontSize: 10, position: "insideBottom", offset: -2 }} />
              <YAxis dataKey="y" type="number" domain={[0, 1]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} label={{ value: "Secondary Score", fill: CHART_COLORS.text, fontSize: 10, angle: -90, position: "insideLeft" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--text-primary)" }}
                formatter={(v: unknown) => typeof v === "number" ? v.toFixed(4) : String(v)}
              />
              <ReferenceLine x={0.5} stroke="var(--accent)" strokeDasharray="3 3" label={{ value: "PRI thr", fill: "var(--accent)", fontSize: 9 }} />
              <ReferenceLine y={0.5} stroke="var(--accent)" strokeDasharray="3 3" label={{ value: "SEC thr", fill: "var(--accent)", fontSize: 9 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
              <Scatter name="Normal"  data={normalPts}  fill={CHART_COLORS.normal} opacity={0.7} />
              <Scatter name="Attack"  data={attackPts}  fill={CHART_COLORS.attack} opacity={0.7} />
              {disagreePts.length > 0 && (
                <Scatter name="Disagree" data={disagreePts} fill={CHART_COLORS.moderate} shape="triangle" opacity={0.9} />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Risk distribution */}
        <ChartCard title="Risk Level Distribution" subtitle="Based on ensemble score thresholds" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskBar} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} formatter={fmtNumber} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {riskBar.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Results table */}
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Prediction Details</p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Threshold: <span className="font-mono" style={{ color: "var(--accent)" }}>{summary.threshold.toFixed(4)}</span>
            {"  ·  "}Weights: <span className="font-mono" style={{ color: "var(--accent)" }}>{summary.w_primary.toFixed(2)}</span> / <span className="font-mono" style={{ color: "var(--color-normal)" }}>{summary.w_secondary.toFixed(2)}</span>
          </p>
        </div>
        <DataTable
          columns={COLS}
          data={rows}
          pageSize={12}
          searchable
          searchKeys={["final_prediction", "risk_level", "primary_pred", "secondary_pred"] as (keyof EnsembleRowResult)[]}
          downloadable
          downloadName="ensemble_predictions.csv"
        />
      </div>
    </div>
  );
}
