"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ConfusionMatrix from "@/components/ml/ConfusionMatrix";
import ChartCard from "@/components/ui/ChartCard";
import DataTable, { Column } from "@/components/ui/DataTable";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Activity, TrendingUp } from "lucide-react";
import { PRIMARY_METRICS, SECONDARY_METRICS } from "@/lib/mockData";
import { CHART_COLORS, formatMetric } from "@/lib/utils";
import { fmtPct } from "@/lib/chartHelpers";
import type { ModelMetrics } from "@/types";

const ALL_METRICS = [
  ...PRIMARY_METRICS.map((m)  => ({ ...m, dataset: "Primary"   })),
  ...SECONDARY_METRICS.map((m) => ({ ...m, dataset: "Secondary" })),
];

const METRICS_COLS: Column<ModelMetrics & { dataset: string }>[] = [
  { key: "dataset",    header: "Dataset",   render: (r) => (
    <span className={`text-xs font-semibold ${r.dataset === "Primary" ? "text-[var(--accent)]" : "text-[var(--color-normal)]"}`}>{r.dataset}</span>
  )},
  { key: "model_name", header: "Model",     render: (r) => <span className="text-[var(--text-secondary)] text-xs font-medium">{r.model_name}</span> },
  { key: "accuracy",   header: "Accuracy",  sortable: true, render: (r) => <span className="font-mono text-[var(--text-primary)]">{formatMetric(r.accuracy)}</span> },
  { key: "precision",  header: "Precision", sortable: true, render: (r) => <span className="font-mono text-[var(--text-secondary)]">{formatMetric(r.precision)}</span> },
  { key: "recall",     header: "Recall",    sortable: true, render: (r) => <span className="font-mono text-[var(--color-normal)]">{formatMetric(r.recall)}</span> },
  { key: "f1",         header: "F1",        sortable: true, render: (r) => <span className="font-mono text-[var(--text-secondary)]">{formatMetric(r.f1)}</span> },
  { key: "roc_auc",    header: "AUC",       sortable: true, render: (r) => <span className="font-mono text-[var(--color-normal)]">{formatMetric(r.roc_auc)}</span> },
  { key: "tp",         header: "TP",        render: (r) => <span className="font-mono text-[var(--color-normal)]">{r.tp.toLocaleString()}</span> },
  { key: "tn",         header: "TN",        render: (r) => <span className="font-mono text-[var(--color-normal)]">{r.tn.toLocaleString()}</span> },
  { key: "fp",         header: "FP",        render: (r) => <span className="font-mono text-[var(--color-review)]">{r.fp.toLocaleString()}</span> },
  { key: "fn",         header: "FN ↓",      sortable: true, render: (r) => <span className="font-mono text-[var(--color-attack)] font-semibold">{r.fn.toLocaleString()}</span> },
];

const radarData = ["Accuracy", "Precision", "Recall", "F1", "AUC"].map((label, i) => {
  const keys = ["accuracy","precision","recall","f1","roc_auc"] as (keyof ModelMetrics)[];
  return {
    metric: label,
    "Primary LR":   +(PRIMARY_METRICS[0][keys[i]] as number * 100).toFixed(1),
    "Primary RF":   +(PRIMARY_METRICS[1][keys[i]] as number * 100).toFixed(1),
    "Primary Hyb":  +(PRIMARY_METRICS[2][keys[i]] as number * 100).toFixed(1),
    "Secondary LR": +(SECONDARY_METRICS[0][keys[i]] as number * 100).toFixed(1),
    "Secondary RF": +(SECONDARY_METRICS[1][keys[i]] as number * 100).toFixed(1),
    "Secondary Hyb":+(SECONDARY_METRICS[2][keys[i]] as number * 100).toFixed(1),
  };
});

const fnBarData = [
  { model: "LR",     Primary: 437, Secondary: 1371 },
  { model: "RF",     Primary: 51,  Secondary: 20   },
  { model: "Hybrid", Primary: 66,  Secondary: 20   },
];

export default function PerformancePage() {
  return (
    <DashboardLayout title="Performance" subtitle="Full evaluation metrics across all models and datasets">
      <PageHeader
        title="Model Performance"
        subtitle="Saved test-set metrics shown separately for each dataset and experiment"
        badge="Saved Experiment Metrics"
        badgeColor="emerald"
      />

      {/* ── Top KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Highest Saved F1"    value="99.65%" subtitle="CIC-IDS-2017 · reference" accent="violet" icon={<TrendingUp size={15}/>} />
        <StatCard title="Highest Saved Recall" value="99.66%" subtitle="CIC-IDS-2017 · reference" accent="emerald" icon={<Activity size={15}/>} />
        <StatCard title="Lowest Saved FN"     value="20"     subtitle="CIC-IDS-2017 · reference" accent="emerald" icon={<Activity size={15}/>} />
        <StatCard title="Highest Saved AUC"    value="99.95%" subtitle="CIC-IDS-2017 · reference" accent="cyan"    icon={<TrendingUp size={15}/>} />
      </div>

      {/* ── Full metrics table ──────────────────────────────── */}
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Complete Metrics — All Models × Both Datasets</p>
        <DataTable
          columns={METRICS_COLS}
          data={ALL_METRICS}
          pageSize={10}
          downloadable
          downloadName="all_metrics.csv"
        />
      </div>

      {/* ── Confusion matrices ──────────────────────────────── */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Primary Model — Confusion Matrices (3,607 test rows)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {PRIMARY_METRICS.map((m) => (
            <ConfusionMatrix key={m.model_name} tp={m.tp} tn={m.tn} fp={m.fp} fn={m.fn} modelName={m.model_name} />
          ))}
        </div>
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Secondary Model — Confusion Matrices (30,000 test rows)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {SECONDARY_METRICS.map((m) => (
            <ConfusionMatrix key={m.model_name} tp={m.tp} tn={m.tn} fp={m.fp} fn={m.fn} modelName={m.model_name} />
          ))}
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar */}
        <ChartCard title="Performance Radar — All Models" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke={CHART_COLORS.grid} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
              <Radar name="Primary RF"    dataKey="Primary RF"    stroke={CHART_COLORS.primary}   fill={CHART_COLORS.primary}   fillOpacity={0.1} strokeWidth={1.5} />
              <Radar name="Primary Hyb"  dataKey="Primary Hyb"   stroke="var(--accent-strong)"                fill="var(--accent-strong)"                fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              <Radar name="Secondary RF" dataKey="Secondary RF"  stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.1} strokeWidth={1.5} />
              <Radar name="Secondary Hyb"dataKey="Secondary Hyb" stroke="var(--color-normal-soft)"                fill="var(--color-normal-soft)"                fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--text-primary)" }} formatter={fmtPct} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* FN bar */}
        <ChartCard title="False Negatives — Missed Attacks" subtitle="Lower is better" height="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fnBarData} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="model" tick={{ fill: CHART_COLORS.text, fontSize: 12 }} />
              <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
              <Bar dataKey="Primary"   fill={CHART_COLORS.primary}   radius={[4,4,0,0]} />
              <Bar dataKey="Secondary" fill={CHART_COLORS.secondary} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── FN analysis note ───────────────────────────────── */}
      <div className="rounded-xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--color-attack) 20%, var(--border))", background: "color-mix(in srgb, var(--color-attack) 5%, transparent)" }}>
        <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Activity size={15} style={{ color: "var(--color-attack)" }} /> False Negative (FN) Analysis
        </p>
        <p className="text-[12px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
          In a Security Operations Centre (SOC), every False Negative is an attack that slipped through undetected.
          This is the most dangerous type of error. The goal is to minimise FN while keeping FP low enough that
          analysts are not overwhelmed with false alarms.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: "Primary LR FN",      value: "437", color: "var(--color-attack)",   sub: "14.6% of 2,989 attacks missed" },
            { label: "Primary RF FN",      value: "51",  color: "var(--color-review)",   sub: "1.7% missed" },
            { label: "Primary Hybrid FN",  value: "66",  color: "var(--color-review)",   sub: "2.2% missed" },
            { label: "Secondary Hybrid FN",value: "20",  color: "var(--color-normal)",   sub: "0.34% missed (best)" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="rounded-lg border p-3 text-center" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
              <p className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
