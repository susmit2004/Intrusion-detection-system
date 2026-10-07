"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import ChartCard from "@/components/ui/ChartCard";
import FeatureImportance from "@/components/ml/FeatureImportance";
import DataTable, { Column } from "@/components/ui/DataTable";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from "recharts";
import { BarChart3, Info } from "lucide-react";
import { SECONDARY_FEATURE_IMPORTANCE, PRIMARY_FEATURE_IMPORTANCE, SECONDARY_FEATURE_STATS } from "@/lib/mockData";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";
import type { FeatureStats } from "@/types";

const STATS_COLUMNS: Column<FeatureStats>[] = [
  { key: "feature",       header: "Feature",        className: "font-medium text-slate-200" },
  { key: "normal_median", header: "Normal Median",  sortable: true, render: (r) => (
    <span className="font-mono text-emerald-400">{r.normal_median.toLocaleString()}</span>
  )},
  { key: "attack_median", header: "Attack Median",  sortable: true, render: (r) => (
    <span className="font-mono text-red-400">{r.attack_median.toLocaleString()}</span>
  )},
  { key: "normal_mean",   header: "Normal Mean",    render: (r) => (
    <span className="font-mono text-slate-400">{r.normal_mean.toLocaleString(undefined, {maximumFractionDigits: 1})}</span>
  )},
  { key: "attack_mean",   header: "Attack Mean",    render: (r) => (
    <span className="font-mono text-slate-400">{r.attack_mean.toLocaleString(undefined, {maximumFractionDigits: 1})}</span>
  )},
  { key: "attack_median", id: "attack_normal_ratio", header: "Ratio A/N", render: (r) => {
    const ratio = r.normal_median > 0 ? r.attack_median / r.normal_median : 0;
    const strong = ratio < 0.3 || ratio > 3;
    return (
      <span className={strong ? "font-semibold text-amber-400 font-mono" : "font-mono text-slate-400"}>
        {ratio.toFixed(2)}×
      </span>
    );
  }},
];

// Comparison chart data (normal vs attack median for key features)
const COMPARISON_DATA = [
  { feature: "bytes/pkt",    normal: 63,   attack: 6,   },
  { feature: "total_bytes",  normal: 219,  attack: 30,  },
  { feature: "Bwd Length",   normal: 130,  attack: 6,   },
  { feature: "Fwd Length",   normal: 66,   attack: 26,  },
  { feature: "total_pkts",   normal: 4,    attack: 5,   },
  { feature: "day_of_week",  normal: 2,    attack: 4,   },
];

export default function AnalysisPage() {
  return (
    <DashboardLayout title="Feature Analysis" subtitle="What the model learned about attack vs normal traffic">
      <PageHeader
        title="Feature Analysis"
        subtitle="Understanding which network-flow features best distinguish attacks from normal traffic"
        badge="CIC-IDS-2017 Training Data"
        badgeColor="blue"
      />

      {/* ── Key insight callout ─────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-300 mb-1.5">Why bytes_per_packet is the strongest attack signal</p>
            <p className="text-[12px] text-blue-200/70 leading-relaxed">
              In CIC-IDS-2017, attack flows (DoS/DDoS/PortScan) have{" "}
              <strong className="text-yellow-300">bytes_per_packet median = 6</strong> while normal
              traffic has{" "}
              <strong className="text-yellow-300">median = 63</strong> — a 10× difference. This is
              because DoS floods send millions of tiny request packets with almost no payload, while
              normal web browsing sends full data packets. The Random Forest correctly learns this
              pattern and uses it as the primary discriminator (importance = 15.77%).
            </p>
          </div>
        </div>
      </div>

      {/* ── Feature importance side-by-side ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <FeatureImportance
          items={SECONDARY_FEATURE_IMPORTANCE}
          title="Secondary Model RF Feature Importance (12 features)"
          maxItems={12}
        />
        <FeatureImportance
          items={PRIMARY_FEATURE_IMPORTANCE}
          title="Primary Model RF Feature Importance (22 features)"
          maxItems={12}
        />
      </div>

      {/* ── Normal vs Attack median comparison ────────────────── */}
      <ChartCard
        title="Normal vs Attack — Feature Median Comparison"
        subtitle="CIC-IDS-2017 training data (secondary model)"
        height="h-72"
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={COMPARISON_DATA} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="feature" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
            <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} scale="log" domain={[1, "auto"]} />
            <Tooltip
              contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}
              formatter={fmtNumber}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="normal" name="Normal (median)" fill={CHART_COLORS.normal} radius={[3,3,0,0]} />
            <Bar dataKey="attack" name="Attack (median)" fill={CHART_COLORS.attack} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Feature stats table ─────────────────────────────── */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={15} className="text-blue-400" />
          <p className="text-sm font-semibold text-white">Feature Statistics — Normal vs Attack (CIC-IDS-2017)</p>
        </div>
        <p className="text-[11px] text-slate-500 mb-4">
          Ratio A/N = Attack median ÷ Normal median. Values highlighted in amber indicate strong discriminative power.
        </p>
        <DataTable
          columns={STATS_COLUMNS}
          data={SECONDARY_FEATURE_STATS}
          pageSize={12}
          downloadable
          downloadName="feature_stats.csv"
        />
      </div>

      {/* ── Attack signature guide ─────────────────────────── */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-4">Attack Traffic Signatures (CIC-IDS-2017)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: "DoS Hulk",       sig: "bytes_per_packet ≈ 4, total_bytes ≈ 12, Bwd Pkts = 1, day_of_week = 4" },
            { name: "DDoS",           sig: "bytes_per_packet ≈ 8, total_bytes ≈ 20, Fwd Pkts ≤ 4, Dest Port = 80" },
            { name: "PortScan",       sig: "bytes_per_packet ≈ 10, total_bytes ≈ 20, varied Dest Ports, Bwd Pkts = 1" },
            { name: "FTP-Patator",    sig: "bytes_per_packet ≈ 15–25, Dest Port = 21, total_pkts = 7–14" },
            { name: "SSH-Patator",    sig: "bytes_per_packet ≈ 30–60, Dest Port = 22, moderate packet count" },
            { name: "DoS GoldenEye",  sig: "bytes_per_packet ≈ 6, HTTP floods, day_of_week = 3–4" },
            { name: "DoS slowloris",  sig: "bytes_per_packet ≈ 50, slow connection, longer duration" },
            { name: "Web Attack",     sig: "Dest Port = 80/443, moderate bytes, HTTP request patterns" },
          ].map(({ name, sig }) => (
            <div key={name} className="rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] p-3">
              <p className="text-xs font-semibold text-red-400 mb-1">{name}</p>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">{sig}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
