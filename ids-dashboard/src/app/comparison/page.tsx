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
        subtitle="Side-by-side evaluation of both models on their respective unseen test sets"
        badge="No Data Leakage · Independent Test Sets"
        badgeColor="emerald"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-[#0a1628] border border-[#1e3a5f] px-3 py-1.5 rounded-lg">
          <GitCompare size={11} className="text-emerald-400" />
          <span>Read-only · No retraining</span>
        </div>
      </PageHeader>

      {/* ── Quick comparison KPIs ──────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Secondary Hybrid Accuracy"
          value={formatMetric(SEC_H.accuracy)}
          subtitle="vs Primary 97.59%"
          icon={<TrendingUp size={15}/>}
          accent="violet"
          trend="up" trendLabel="+2.27%"
        />
        <StatCard
          title="Secondary Hybrid Recall"
          value={formatMetric(SEC_H.recall)}
          subtitle="vs Primary 97.79%"
          icon={<CheckCircle size={15}/>}
          accent="emerald"
          trend="up" trendLabel="+1.87%"
        />
        <StatCard
          title="Primary Missed Attacks"
          value={PRI_H.fn.toString()}
          subtitle="out of 2,989 attacks"
          icon={<AlertTriangle size={15}/>}
          accent="amber"
        />
        <StatCard
          title="Secondary Missed Attacks"
          value={SEC_H.fn.toString()}
          subtitle="out of 5,922 attacks"
          icon={<AlertTriangle size={15}/>}
          accent="emerald"
          trend="down" trendLabel="Fewer"
        />
      </div>

      {/* ── Important note ─────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-xs font-semibold text-amber-300 mb-1.5">⚠ Fair Comparison Disclaimer</p>
        <p className="text-[12px] text-amber-200/70 leading-relaxed">
          The Primary and Secondary models were trained on completely different datasets with different attack-rate distributions
          (Primary: 82.9% attack, Secondary: 19.7% attack). Direct metric comparison should account for these differences.
          The Secondary model&apos;s higher overall accuracy is partially explained by the larger, more balanced test set.
          Both models are independently evaluated on their own unseen test data — no cross-contamination.
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
      <div className="mt-6 rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-4">Key Differences Between Models</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f1f3d] border-b border-[#1e3a5f]">
                {["Aspect", "Primary Model", "Secondary Model"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
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
                <tr key={aspect} className={`border-b border-[#1e3a5f]/50 ${i%2===0?"bg-[#0a1628]":"bg-[#0c1a30]"}`}>
                  <td className="px-4 py-2.5 font-semibold text-slate-300">{aspect}</td>
                  <td className="px-4 py-2.5 text-slate-400">{pri}</td>
                  <td className="px-4 py-2.5 text-slate-400">{sec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
