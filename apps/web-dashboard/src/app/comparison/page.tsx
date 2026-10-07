"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ModelComparison from "@/components/ml/ModelComparison";
import ModelCard from "@/components/ml/ModelCard";
import { GitCompare, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { PRIMARY_METRICS, SECONDARY_METRICS } from "@/lib/mockData";
import { formatMetric } from "@/lib/utils";
import { PRIMARY_CONFIG, SECONDARY_CONFIG } from "@/lib/constants";

const PRI_H  = PRIMARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;
const PRI_RF = PRIMARY_METRICS.find((m) => m.model_name === "Random Forest")!;
const PRI_LR = PRIMARY_METRICS.find((m) => m.model_name === "Logistic Regression")!;
const SEC_H  = SECONDARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;
const SEC_RF = SECONDARY_METRICS.find((m) => m.model_name === "Random Forest")!;
const SEC_LR = SECONDARY_METRICS.find((m) => m.model_name === "Logistic Regression")!;

export default function ComparisonPage() {
  return (
    <DashboardLayout title="Model Comparison" subtitle="Primary vs Secondary — cross-dataset analysis">
      <PageHeader
        title="Model Comparison"
        subtitle="Side-by-side evaluation of both models on their respective independent test sets"
        badge="Independent Test Sets · Different Populations"
        badgeColor="teal"
      >
        <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <GitCompare size={11} style={{ color: "var(--color-normal)" }} />
          <span>Read-only · No retraining</span>
        </div>
      </PageHeader>

      {/* ── Quick comparison KPIs ──────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Secondary Hybrid Accuracy"
          value={formatMetric(SEC_H.accuracy)}
          subtitle="CIC-IDS-2017 saved result"
          icon={<TrendingUp size={15}/>}
          accent="violet"
        />
        <StatCard
          title="Secondary Hybrid Recall"
          value={formatMetric(SEC_H.recall)}
          subtitle="CIC-IDS-2017 saved result"
          icon={<CheckCircle size={15}/>}
          accent="emerald"
        />
        <StatCard
          title="Primary Missed Attacks"
          value={PRI_H.fn.toString()}
          subtitle="Primary test population"
          icon={<AlertTriangle size={15}/>}
          accent="amber"
        />
        <StatCard
          title="Secondary Missed Attacks"
          value={SEC_H.fn.toString()}
          subtitle="CIC-IDS-2017 test population"
          icon={<AlertTriangle size={15}/>}
          accent="emerald"
        />
      </div>

      {/* ── Important note ─────────────────────────────────── */}
      <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--color-review) 20%, var(--border))", background: "color-mix(in srgb, var(--color-review) 5%, transparent)" }}>
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-review)" }}>Fair Comparison Note</p>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--color-review)", opacity: 0.8 }}>
          These are saved results from separate datasets, test populations, and class distributions. Read each score within its own experiment; a numeric difference does not establish performance on other traffic.
        </p>
      </div>

      {/* ── Model cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ModelCard
          label="Primary Model (Hybrid)"
          dataset="Suricata IDS Testbed"
          nFeatures={22}
          metrics={PRI_H}
          lrMetrics={PRI_LR}
          rfMetrics={PRI_RF}
          wLr={PRIMARY_CONFIG.w_lr}
          wRf={PRIMARY_CONFIG.w_rf}
          threshold={PRIMARY_CONFIG.decision_threshold}
          color="blue"
        />
        <ModelCard
          label="Secondary Model (Hybrid)"
          dataset="CIC-IDS-2017"
          nFeatures={12}
          metrics={SEC_H}
          lrMetrics={SEC_LR}
          rfMetrics={SEC_RF}
          wLr={SECONDARY_CONFIG.w_lr}
          wRf={SECONDARY_CONFIG.w_rf}
          threshold={SECONDARY_CONFIG.decision_threshold}
          color="violet"
        />
      </div>

      {/* ── Full comparison component ──────────────────────── */}
      <ModelComparison primaryHybrid={PRI_H} secondaryHybrid={SEC_H} />

      {/* ── Key differences ────────────────────────────────── */}
      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Key Differences Between Models</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                {["Aspect", "Primary Model", "Secondary Model"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Source Data",      "Suricata IDS testbed (July–Sep 2026)", "CIC-IDS-2017 (UNB benchmark)"],
                ["Features",         "22 (protocol flags, port flags, byte ratios)", "12 (raw network flow statistics)"],
                ["Train rows",       "12,262",                               "49,053"],
                ["Test rows",        "3,607",                                "30,000"],
                ["Attack rate",      "82.9% (attack-heavy)",                 "19.7% (realistic distribution)"],
                ["Split method",     "Time-based (last 15% as validation)",  "Feature-group-stratified 70/15/15"],
                ["Hybrid weights",   "w_LR=0.30, w_RF=0.70",                "w_LR=0.00, w_RF=1.00"],
                ["Decision threshold","0.5025 (F1-optimal on val set)",      "0.4536 (F1-optimal on tuning set)"],
                ["LR recall",        "85.38%",                               "76.85%"],
                ["RF recall",        "98.29%",                               "99.66%"],
                ["Hybrid FN",        "66 missed attacks",                    "20 missed attacks"],
                ["Why LR weaker?",   "LR useful but limited on 22 features", "w_LR=0.0: RF dominates completely"],
              ].map(([aspect, pri, sec], i) => (
                <tr key={aspect} className="border-b" style={{ background: i%2===0 ? "var(--bg-card)" : "var(--bg-card-alt)", borderColor: "color-mix(in srgb, var(--border) 50%, transparent)" }}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text-secondary)" }}>{aspect}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>{pri}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>{sec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
