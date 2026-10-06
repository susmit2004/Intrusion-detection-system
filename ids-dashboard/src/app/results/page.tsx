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
  { key: "id",           header: "#",      className: "w-8 text-slate-500" },
  { key: "attack_type",  header: "Category", render: (r) => <span className="text-xs text-slate-300">{r.attack_type ?? "—"}</span> },
  { key: "lr_prob_raw",  header: "LR Raw",  render: (r) => <span className="font-mono text-[11px] text-sky-400/60">{formatScore(r.lr_prob_raw)}</span> },
  { key: "rf_prob_raw",  header: "RF Raw",  render: (r) => <span className="font-mono text-[11px] text-orange-400/60">{formatScore(r.rf_prob_raw)}</span> },
  { key: "lr_prob_calibrated", header: "LR Cal", render: (r) => <span className="font-mono text-[11px] text-sky-400">{formatScore(r.lr_prob_calibrated)}</span> },
  { key: "rf_prob_calibrated", header: "RF Cal", render: (r) => <span className="font-mono text-[11px] text-orange-400">{formatScore(r.rf_prob_calibrated)}</span> },
  { key: "hybrid_score_calibrated", header: "Hybrid Score", sortable: true, render: (r) => {
    const s = r.hybrid_score_calibrated;
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-violet-400 font-semibold text-[11px]">{formatScore(s)}</span>
        <div className="w-16 h-1.5 rounded-full bg-[#1e3a5f] overflow-hidden">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${s * 100}%` }} />
        </div>
      </div>
    );
  }},
  { key: "prediction",   header: "Prediction", render: (r) => <PredictionBadge prediction={r.prediction} size="sm" /> },
  { key: "risk_level",   header: "Risk Level",  render: (r) => <RiskBadge level={r.risk_level} size="sm" /> },
  { key: "triage_level", header: "Triage",      render: (r) => <span className="text-[11px] text-slate-400">{r.triage_level}</span> },
  { key: "correct",      header: "Correct?",    render: (r) => r.correct !== undefined ? (
    <span className={r.correct ? "text-emerald-400 text-xs" : "text-red-400 text-xs font-bold"}>
      {r.correct ? "✓" : "✗ FN"}
    </span>
  ) : <span className="text-slate-600 text-xs">—</span> },
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
        subtitle="Detailed row-level results showing LR, RF, Hybrid Score, and risk classification"
        badge="Secondary Model · Sample 15 rows"
        badgeColor="violet"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-[#0a1628] border border-[#1e3a5f] px-3 py-1.5 rounded-lg">
          <Cpu size={11} className="text-violet-400" />
          <span>Hybrid = w_RF × RF_cal (w_RF=1.0)</span>
        </div>
      </PageHeader>

      {/* ── Quick stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total",    value: MOCK_PREDICTION_ROWS.length, color: "text-white"        },
          { label: "Normal",   value: normal,   color: "text-emerald-400" },
          { label: "Attack",   value: attacks,  color: "text-red-400"     },
          { label: "High Risk",value: high,     color: "text-red-400"     },
          { label: "Low Risk", value: low,      color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] px-4 py-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
            <p className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</p>
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
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-2">Sample Prediction Records</p>
        <p className="text-[11px] text-slate-500 mb-4">
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
      <div className="mt-6 rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-3">How to Read the Hybrid Score</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { range: "Score ≥ 0.70", label: "High Risk", color: "text-red-400", border: "border-red-500/20", bg: "bg-red-500/5",
              desc: "Model is highly confident this is an attack. RF assigned 70%+ probability. Immediate SOC action required." },
            { range: "0.40 ≤ Score < 0.70", label: "Moderate Risk", color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/5",
              desc: "Probable attack but confidence is lower. Could be borderline traffic. Analyst review recommended." },
            { range: "Score < 0.40", label: "Low Risk", color: "text-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/5",
              desc: "Model is confident this is normal traffic. Log for audit trail, no immediate SOC action needed." },
          ].map(({ range, label, color, border, bg, desc }) => (
            <div key={label} className={`rounded-lg border ${border} ${bg} p-3`}>
              <p className={`text-xs font-mono font-semibold ${color}`}>{range}</p>
              <p className={`text-sm font-bold mt-0.5 ${color}`}>{label}</p>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
