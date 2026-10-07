"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import ChartCard from "@/components/ui/ChartCard";
import FeatureImportance from "@/components/ml/FeatureImportance";
import DataTable, { Column } from "@/components/ui/DataTable";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { BarChart3, Info } from "lucide-react";
import { SECONDARY_FEATURE_IMPORTANCE, PRIMARY_FEATURE_IMPORTANCE, SECONDARY_FEATURE_STATS } from "@/lib/mockData";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";
import type { FeatureStats } from "@/types";

const STATS_COLUMNS: Column<FeatureStats>[] = [
  { key: "feature",       header: "Feature",        className: "font-medium text-[var(--text-primary)]" },
  { key: "normal_median", header: "Normal Median",  sortable: true, render: (r) => (
    <span className="font-mono text-[var(--color-normal)]">{r.normal_median.toLocaleString()}</span>
  )},
  { key: "attack_median", header: "Attack Median",  sortable: true, render: (r) => (
    <span className="font-mono text-[var(--color-attack)]">{r.attack_median.toLocaleString()}</span>
  )},
  { key: "normal_mean",   header: "Normal Mean",    render: (r) => (
    <span className="font-mono text-[var(--text-secondary)]">{r.normal_mean.toLocaleString(undefined, {maximumFractionDigits: 1})}</span>
  )},
  { key: "attack_mean",   header: "Attack Mean",    render: (r) => (
    <span className="font-mono text-[var(--text-secondary)]">{r.attack_mean.toLocaleString(undefined, {maximumFractionDigits: 1})}</span>
  )},
  { key: "attack_median", id: "attack_normal_ratio", header: "Ratio A/N", render: (r) => {
    const ratio = r.normal_median > 0 ? r.attack_median / r.normal_median : 0;
    const strong = ratio < 0.3 || ratio > 3;
    return (
      <span className={strong ? "font-semibold text-[var(--color-review)] font-mono" : "font-mono text-[var(--text-secondary)]"}>
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
      <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--model-lr) 20%, var(--border))", background: "color-mix(in srgb, var(--model-lr) 5%, transparent)" }}>
        <div className="flex items-start gap-2">
          <Info size={14} style={{ color: "var(--model-lr)" }} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--model-lr)" }}>Feature statistics need dataset context</p>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--model-lr)", opacity: 0.8 }}>
              The saved CIC-IDS-2017 training statistics show a median of 6 for attack-labeled rows and 63 for normal-labeled rows on <code>bytes_per_packet</code>. This is a dataset association, not a causal explanation or a standalone detection rule. Feature importance describes the fitted model&apos;s ranking.
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
              contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }}
              formatter={fmtNumber}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
            <Bar dataKey="normal" name="Normal (median)" fill={CHART_COLORS.normal} radius={[3,3,0,0]} />
            <Bar dataKey="attack" name="Attack (median)" fill={CHART_COLORS.attack} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Feature stats table ─────────────────────────────── */}
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={15} style={{ color: "var(--accent)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Feature Statistics — Normal vs Attack (CIC-IDS-2017)</p>
        </div>
        <p className="text-[11px] mb-4" style={{ color: "var(--text-muted)" }}>
          Ratio A/N = Attack median ÷ Normal median. Values highlighted indicate strong discriminative power.
        </p>
        <DataTable
          columns={STATS_COLUMNS}
          data={SECONDARY_FEATURE_STATS}
          pageSize={12}
          downloadable
          downloadName="feature_stats.csv"
        />
      </div>

    </DashboardLayout>
  );
}
