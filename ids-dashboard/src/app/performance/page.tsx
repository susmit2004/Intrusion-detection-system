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
import { fmtPct, fmtNumber } from "@/lib/chartHelpers";
import type { ModelMetrics } from "@/types";

const ALL_METRICS = [
  ...PRIMARY_METRICS.map((m)  => ({ ...m, dataset: "Primary"   })),
  ...SECONDARY_METRICS.map((m) => ({ ...m, dataset: "Secondary" })),
];

const METRICS_COLS: Column<ModelMetrics & { dataset: string }>[] = [
  { key: "dataset",    header: "Dataset",   render: (r) => (
    <span className={`text-xs font-semibold ${r.dataset === "Primary" ? "text-blue-400" : "text-violet-400"}`}>{r.dataset}</span>
  )},
  { key: "model_name", header: "Model",     render: (r) => <span className="text-slate-300 text-xs font-medium">{r.model_name}</span> },
  { key: "accuracy",   header: "Accuracy",  sortable: true, render: (r) => <span className="font-mono text-white">{formatMetric(r.accuracy)}</span> },
  { key: "precision",  header: "Precision", sortable: true, render: (r) => <span className="font-mono text-slate-300">{formatMetric(r.precision)}</span> },
  { key: "recall",     header: "Recall",    sortable: true, render: (r) => <span className="font-mono text-emerald-400">{formatMetric(r.recall)}</span> },
  { key: "f1",         header: "F1",        sortable: true, render: (r) => <span className="font-mono text-slate-300">{formatMetric(r.f1)}</span> },
  { key: "roc_auc",    header: "AUC",       sortable: true, render: (r) => <span className="font-mono text-cyan-400">{formatMetric(r.roc_auc)}</span> },
  { key: "tp",         header: "TP",        render: (r) => <span className="font-mono text-emerald-400">{r.tp.toLocaleString()}</span> },
  { key: "tn",         header: "TN",        render: (r) => <span className="font-mono text-emerald-400">{r.tn.toLocaleString()}</span> },
  { key: "fp",         header: "FP",        render: (r) => <span className="font-mono text-amber-400">{r.fp.toLocaleString()}</span> },
  { key: "fn",         header: "FN ↓",      sortable: true, render: (r) => <span className="font-mono text-red-400 font-semibold">{r.fn.toLocaleString()}</span> },
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
        subtitle="Comprehensive evaluation on unseen test sets — no data leakage"
        badge="Test Set Results Only"
        badgeColor="emerald"
      />

      {/* ── Top KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Best F1 Score"    value="99.65%" subtitle="Secondary Hybrid · test set" accent="violet" icon={<TrendingUp size={15}/>} />
        <StatCard title="Best Recall"      value="99.66%" subtitle="Secondary RF/Hybrid"          accent="emerald" icon={<Activity size={15}/>} />
        <StatCard title="Lowest FN"        value="20"     subtitle="Secondary RF/Hybrid"          accent="emerald" icon={<Activity size={15}/>} />
        <StatCard title="Best AUC"         value="99.95%" subtitle="Secondary RF/Hybrid"          accent="cyan"    icon={<TrendingUp size={15}/>} />
      </div>

      {/* ── Full metrics table ──────────────────────────────── */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5 mb-6">
        <p className="text-sm font-semibold text-white mb-4">Complete Metrics — All Models × Both Datasets</p>
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
        <h3 className="text-sm font-semibold text-white mb-4">Primary Model — Confusion Matrices (3,607 test rows)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {PRIMARY_METRICS.map((m) => (
            <ConfusionMatrix key={m.model_name} tp={m.tp} tn={m.tn} fp={m.fp} fn={m.fn} modelName={m.model_name} />
          ))}
        </div>
        <h3 className="text-sm font-semibold text-white mb-4">Secondary Model — Confusion Matrices (30,000 test rows)</h3>
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
              <Radar name="Primary Hyb"  dataKey="Primary Hyb"   stroke="#93c5fd"                fill="#93c5fd"                fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              <Radar name="Secondary RF" dataKey="Secondary RF"  stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={0.1} strokeWidth={1.5} />
              <Radar name="Secondary Hyb"dataKey="Secondary Hyb" stroke="#c4b5fd"                fill="#c4b5fd"                fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 2" />
              <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 11 }} formatter={fmtPct} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
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
              <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Primary"   fill={CHART_COLORS.primary}   radius={[4,4,0,0]} />
              <Bar dataKey="Secondary" fill={CHART_COLORS.secondary} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── FN analysis note ───────────────────────────────── */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Activity size={15} className="text-red-400" /> False Negative (FN) Analysis
        </p>
        <p className="text-[12px] text-slate-400 leading-relaxed mb-3">
          In a Security Operations Centre (SOC), every False Negative is an attack that slipped through undetected.
          This is the most dangerous type of error. The goal is to minimise FN while keeping FP low enough that
          analysts are not overwhelmed with false alarms.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { label: "Primary LR FN",    value: "437", color: "text-red-400",     sub: "14.6% of 2,989 attacks missed" },
            { label: "Primary RF FN",    value: "51",  color: "text-amber-400",   sub: "1.7% missed" },
            { label: "Primary Hybrid FN",value: "66",  color: "text-amber-400",   sub: "2.2% missed" },
            { label: "Secondary Hybrid FN",value:"20", color: "text-emerald-400", sub: "0.34% missed (best)" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] p-3 text-center">
              <p className="text-slate-500 text-[10px] mb-1">{label}</p>
              <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
