"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import DataTable, { Column } from "@/components/ui/DataTable";
import { RiskBadge, PredictionBadge } from "@/components/ui/RiskBadge";
import ChartCard from "@/components/ui/ChartCard";
import AttackCategoryChart from "@/components/charts/AttackCategoryChart";
import RiskDistributionChart from "@/components/charts/RiskDistributionChart";
import { MOCK_PREDICTION_ROWS, SECONDARY_ATTACK_CATEGORIES } from "@/lib/mockData";
import { formatScore } from "@/lib/utils";
import type { PredictionRow } from "@/types";
import { Cpu } from "lucide-react";

const COLS: Column<PredictionRow>[] = [
  { key: "id",           header: "#",      className: "w-8 text-[var(--text-muted)]" },
  { key: "attack_type",  header: "Category", render: (r) => <span className="text-xs text-[var(--text-secondary)]">{r.attack_type ?? "—"}</span> },
  { key: "lr_prob_raw",  header: "LR Raw",  render: (r) => <span className="font-mono text-[11px] text-[var(--model-lr)]">{formatScore(r.lr_prob_raw)}</span> },
  { key: "rf_prob_raw",  header: "RF Raw",  render: (r) => <span className="font-mono text-[11px] text-[var(--color-normal)]">{formatScore(r.rf_prob_raw)}</span> },
  { key: "lr_prob_calibrated", header: "LR Cal", render: (r) => <span className="font-mono text-[11px] text-[var(--model-lr)]">{formatScore(r.lr_prob_calibrated)}</span> },
  { key: "rf_prob_calibrated", header: "RF Cal", render: (r) => <span className="font-mono text-[11px] text-[var(--color-normal)]">{formatScore(r.rf_prob_calibrated)}</span> },
  { key: "hybrid_score_calibrated", header: "Hybrid Score", sortable: true, render: (r) => {
    const s = r.hybrid_score_calibrated;
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold text-[11px]" style={{ color: "var(--accent)" }}>{formatScore(s)}</span>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
          <div className="h-full rounded-full" style={{ width: `${s * 100}%`, background: "var(--accent)" }} />
        </div>
      </div>
    );
  }},
  { key: "prediction",   header: "Prediction", render: (r) => <PredictionBadge prediction={r.prediction} size="sm" /> },
  { key: "risk_level",   header: "Risk Level",  render: (r) => <RiskBadge level={r.risk_level} size="sm" /> },
  { key: "triage_level", header: "Triage",      render: (r) => <span className="text-[11px] text-[var(--text-secondary)]">{r.triage_level}</span> },
  { key: "correct",      header: "Correct?",    render: (r) => r.correct !== undefined ? (
    <span className={r.correct ? "text-[var(--color-normal)] text-xs" : "text-[var(--color-attack)] text-xs font-bold"}>
      {r.correct ? "✓" : "✗ FN"}
    </span>
  ) : <span className="text-[var(--text-muted)] text-xs">—</span> },
];

export default function ResultsPage() {
  const attacks = MOCK_PREDICTION_ROWS.filter((r) => r.prediction === "Attack").length;
  const normal  = MOCK_PREDICTION_ROWS.filter((r) => r.prediction === "Normal").length;
  const high    = MOCK_PREDICTION_ROWS.filter((r) => r.risk_level === "High Risk").length;
  const mod     = MOCK_PREDICTION_ROWS.filter((r) => r.risk_level === "Moderate Risk").length;
  const low     = MOCK_PREDICTION_ROWS.filter((r) => r.risk_level === "Low Risk").length;

  return (
    <DashboardLayout title="Results" subtitle="Sample prediction results from secondary model test set">
      <PageHeader
        title="Prediction Results"
        subtitle="Demonstration prediction rows showing the available output fields. Upload a CSV on the Secondary Model page to view its inference response."
        badge="Demonstration Sample · 15 Rows"
        badgeColor="teal"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1.5 rounded-lg">
          <Cpu size={11} className="text-[var(--color-normal)]" />
          <span>Hybrid = w_RF × RF_cal (w_RF=1.0)</span>
        </div>
      </PageHeader>

      {/* ── Quick stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total",     value: MOCK_PREDICTION_ROWS.length, color: "var(--text-primary)" },
          { label: "Normal",    value: normal,   color: "var(--color-normal)" },
          { label: "Attack",    value: attacks,  color: "var(--color-attack)" },
          { label: "High Risk", value: high,     color: "var(--color-attack)" },
          { label: "Low Risk",  value: low,      color: "var(--color-normal)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border px-4 py-3 text-center" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="text-xl font-bold tabular-nums mt-1" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Attack Category Breakdown" height="h-56">
          <AttackCategoryChart data={SECONDARY_ATTACK_CATEGORIES.slice(0, 6)} />
        </ChartCard>
        <ChartCard title="Risk Distribution" height="h-56">
          <RiskDistributionChart high={high} moderate={mod} low={low} />
        </ChartCard>
      </div>

      {/* ── Prediction table ────────────────────────────────── */}
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Sample Prediction Records</p>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
          Each row shows the raw and calibrated probabilities from LR and RF, the computed Hybrid Score,
          the Attack/Normal decision (threshold = 0.4536), and the SOC risk level (High ≥ 0.70 / Moderate ≥ 0.40 / Low &lt; 0.40).
        </p>
        <DataTable
          columns={COLS}
          data={MOCK_PREDICTION_ROWS}
          pageSize={15}
          searchable
          searchKeys={["attack_type", "prediction", "risk_level", "triage_level"] as (keyof PredictionRow)[]}
          downloadable
          downloadName="sample_predictions.csv"
        />
      </div>

      {/* ── Score interpretation guide ──────────────────────── */}
      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>How to Read the Hybrid Score</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { range: "Score ≥ 0.70",       label: "High Risk",     color: "var(--color-attack)",
              desc: "The score reaches the configured high-risk band. Treat it as a review signal, not a confirmed attack." },
            { range: "0.40 ≤ Score < 0.70", label: "Moderate Risk", color: "var(--color-review)",
              desc: "The score sits between the configured risk thresholds. Review it with the available traffic context." },
            { range: "Score < 0.40",        label: "Low Risk",      color: "var(--color-normal)",
              desc: "The score falls below the configured risk thresholds; this does not confirm the traffic is benign." },
          ].map(({ range, label, color, desc }) => (
            <div key={label} className="rounded-lg border p-3" style={{ borderColor: `color-mix(in srgb, ${color} 20%, var(--border))`, background: `color-mix(in srgb, ${color} 5%, transparent)` }}>
              <p className="text-xs font-mono font-semibold" style={{ color }}>{range}</p>
              <p className="text-sm font-bold mt-0.5" style={{ color }}>{label}</p>
              <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
