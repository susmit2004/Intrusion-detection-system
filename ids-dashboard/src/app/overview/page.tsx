"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/ui/StatCard";
import ChartCard from "@/components/ui/ChartCard";
import PageHeader from "@/components/ui/PageHeader";
import AttackDistributionChart from "@/components/charts/AttackDistributionChart";
import RiskDistributionChart from "@/components/charts/RiskDistributionChart";
import AttackCategoryChart from "@/components/charts/AttackCategoryChart";
import TimelineChart from "@/components/charts/TimelineChart";
import {
  Shield, Database, Activity, AlertTriangle,
  CheckCircle, ShieldAlert, TrendingUp, Zap,
} from "lucide-react";
import {
  PRIMARY_METRICS, SECONDARY_METRICS,
  SECONDARY_ATTACK_CATEGORIES, PRIMARY_ATTACK_CATEGORIES,
  HOURLY_DISTRIBUTION,
} from "@/lib/mockData";

/* ── derived stats ─────────────────────────────────────────── */
const PRI_H = PRIMARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;
const SEC_H = SECONDARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;

export default function OverviewPage() {
  return (
    <DashboardLayout
      title="Overview"
      subtitle="Unified view of both intrusion-detection models"
    >
      <PageHeader
        title="Security Operations Overview"
        subtitle="CIC-IDS-2017 · Suricata Testbed · Confidence-Based Hybrid ML Framework"
        badge="Live Dashboard"
      />

      {/* ── Top KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Test Events" value="33,607" subtitle="Both models combined"
          icon={<Activity size={15} />} accent="blue" />
        <StatCard title="Attacks Detected" value="8,911" subtitle="Across both datasets"
          icon={<ShieldAlert size={15} />} accent="red" trend="up" trendLabel="High" />
        <StatCard title="Normal Traffic" value="24,696" subtitle="Correctly classified"
          icon={<CheckCircle size={15} />} accent="emerald" />
        <StatCard title="High Risk Events" value="6,418" subtitle="Immediate SOC attention"
          icon={<AlertTriangle size={15} />} accent="amber" />
      </div>

      {/* ── Model performance side-by-side ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Primary */}
        <div className="rounded-xl border border-blue-500/20 bg-[#0a1628] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-sm font-bold text-white">Primary Model</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
              Suricata Testbed · 22 features
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Accuracy",  value: "97.59%" },
              { label: "Recall",    value: "97.79%" },
              { label: "F1 Score",  value: "98.53%" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2 text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-base font-bold text-blue-400 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
            <span>Test set: <span className="text-white font-medium">3,607</span></span>
            <span>Attack rate: <span className="text-red-400 font-medium">82.9%</span></span>
            <span>FN: <span className="text-amber-400 font-medium">{PRI_H.fn}</span></span>
            <span>AUC: <span className="text-emerald-400 font-medium">{(PRI_H.roc_auc * 100).toFixed(2)}%</span></span>
          </div>
        </div>

        {/* Secondary */}
        <div className="rounded-xl border border-violet-500/20 bg-[#0a1628] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-sm font-bold text-white">Secondary Model</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
              CIC-IDS-2017 · 12 features
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Accuracy",  value: "99.86%" },
              { label: "Recall",    value: "99.66%" },
              { label: "F1 Score",  value: "99.65%" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-violet-500/5 border border-violet-500/10 px-3 py-2 text-center">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-base font-bold text-violet-400 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
            <span>Test set: <span className="text-white font-medium">30,000</span></span>
            <span>Attack rate: <span className="text-red-400 font-medium">19.7%</span></span>
            <span>FN: <span className="text-amber-400 font-medium">{SEC_H.fn}</span></span>
            <span>AUC: <span className="text-emerald-400 font-medium">{(SEC_H.roc_auc * 100).toFixed(2)}%</span></span>
          </div>
        </div>
      </div>

      {/* ── Charts row 1 ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Traffic Distribution" subtitle="Secondary Model test set (30k)" height="h-56">
          <AttackDistributionChart normal={24078} attack={5922} />
        </ChartCard>
        <ChartCard title="Risk Level Distribution" subtitle="High / Moderate / Low" height="h-56">
          <RiskDistributionChart high={5279} moderate={571} low={24150} />
        </ChartCard>
        <ChartCard title="Attack Categories" subtitle="CIC-IDS-2017 test set" height="h-56">
          <AttackCategoryChart data={SECONDARY_ATTACK_CATEGORIES} />
        </ChartCard>
      </div>

      {/* ── Timeline ─────────────────────────────────────────── */}
      <ChartCard
        title="Traffic Timeline"
        subtitle="Hourly normal vs attack flow distribution (CIC-IDS-2017)"
        height="h-52"
        className="mb-4"
      >
        <TimelineChart data={HOURLY_DISTRIBUTION} />
      </ChartCard>

      {/* ── Attack categories primary ─────────────────────────── */}
      <ChartCard
        title="Primary Model — Alert Categories"
        subtitle="Suricata IDS testbed attack classifications"
        height="h-52"
        className="mb-4"
      >
        <AttackCategoryChart data={PRIMARY_ATTACK_CATEGORIES} horizontal={false} />
      </ChartCard>

      {/* ── Key findings ─────────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Zap size={15} className="text-amber-400" />
          Key Findings
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[12px]">
          {[
            { title: "RF dominates on CIC-IDS-2017",   desc: "w_LR=0.0, w_RF=1.0 — grid search found RF alone maximises F1. LR adds no useful signal on 12 raw flow features." },
            { title: "bytes_per_packet is strongest signal", desc: "Normal median=63, Attack median=6. DoS/DDoS floods send tiny packets. This single feature provides the most discrimination." },
            { title: "20 missed attacks out of 5,922", desc: "Secondary Hybrid achieves FN=20, meaning 99.66% of real attacks are caught. Only 0.34% slip through undetected." },
            { title: "Primary LR is more competitive",  desc: "On 22-feature Suricata data, LR reaches 85.4% recall vs only 76.9% on CIC-IDS-2017. Richer features help the linear model." },
            { title: "Threshold selected on validation", desc: "0.4536 (secondary) and 0.5025 (primary) are F1-optimal thresholds from the tuning set — not arbitrary 0.5 defaults." },
            { title: "Calibration improves reliability", desc: "Isotonic calibration on a held-out calibration set converts raw model outputs into trustworthy probability estimates." },
          ].map(({ title, desc }) => (
            <div key={title} className="rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] p-3">
              <p className="font-semibold text-white mb-1">{title}</p>
              <p className="text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
