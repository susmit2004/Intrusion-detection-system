"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import ChartCard from "@/components/ui/ChartCard";
import PageHeader from "@/components/ui/PageHeader";
import AttackDistributionChart from "@/components/charts/AttackDistributionChart";
import RiskDistributionChart from "@/components/charts/RiskDistributionChart";
import AttackCategoryChart from "@/components/charts/AttackCategoryChart";
import TimelineChart from "@/components/charts/TimelineChart";
import { Zap } from "lucide-react";
import {
  PRIMARY_METRICS, SECONDARY_METRICS,
  SECONDARY_ATTACK_CATEGORIES, PRIMARY_ATTACK_CATEGORIES,
  HOURLY_DISTRIBUTION,
} from "@/lib/mockData";

const PRI_H = PRIMARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;
const SEC_H = SECONDARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;

export default function OverviewPage() {
  return (
    <DashboardLayout
      title="Overview"
      subtitle="Experiment summaries for both intrusion-detection models"
    >
      <PageHeader
        title="Research Overview"
        subtitle="Confidence-Based Hybrid ML Framework · CIC-IDS-2017 and Suricata Testbed experiments"
        badge="Research Overview"
        badgeColor="lime"
      />

      <p className="mb-4 text-xs text-[var(--text-secondary)]">
        Saved test-set metrics are shown separately for each experiment.
      </p>

      {/* Model performance panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Primary */}
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: "color-mix(in srgb, var(--accent) 20%, var(--border))", background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Primary Model</span>
            <span
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full border"
              style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}
            >
              Suricata Testbed · 22 features
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Accuracy", value: "97.59%" },
              { label: "Recall",   value: "97.79%" },
              { label: "F1 Score", value: "98.53%" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2 text-center border"
                style={{ background: "color-mix(in srgb, var(--accent) 5%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-base font-bold tabular-nums" style={{ color: "var(--accent)" }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="text-[11px] flex flex-wrap gap-3" style={{ color: "var(--text-muted)" }}>
            <span>Test split: <span className="font-medium" style={{ color: "var(--text-primary)" }}>3,607 rows</span></span>
            <span>Attack rate: <span className="font-medium" style={{ color: "var(--color-review)" }}>82.9%</span></span>
            <span>FN: <span className="font-medium" style={{ color: "var(--color-review)" }}>{PRI_H.fn}</span></span>
            <span>AUC: <span className="font-medium" style={{ color: "var(--color-normal)" }}>{(PRI_H.roc_auc * 100).toFixed(2)}%</span></span>
          </div>
        </div>

        {/* Secondary */}
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: "color-mix(in srgb, var(--color-normal) 20%, var(--border))", background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ background: "var(--color-normal)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Secondary Model</span>
            <span
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full border"
              style={{ background: "color-mix(in srgb, var(--color-normal) 8%, transparent)", borderColor: "color-mix(in srgb, var(--color-normal) 20%, transparent)", color: "var(--color-normal)" }}
            >
              CIC-IDS-2017 · 12 features
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Accuracy", value: "99.86%" },
              { label: "Recall",   value: "99.66%" },
              { label: "F1 Score", value: "99.65%" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-2 text-center border"
                style={{ background: "color-mix(in srgb, var(--color-normal) 5%, transparent)", borderColor: "color-mix(in srgb, var(--color-normal) 12%, transparent)" }}
              >
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-normal)" }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="text-[11px] flex flex-wrap gap-3" style={{ color: "var(--text-muted)" }}>
            <span>Test split: <span className="font-medium" style={{ color: "var(--text-primary)" }}>30,000 rows</span></span>
            <span>Attack rate: <span className="font-medium" style={{ color: "var(--color-review)" }}>19.7%</span></span>
            <span>FN: <span className="font-medium" style={{ color: "var(--color-review)" }}>{SEC_H.fn}</span></span>
            <span>AUC: <span className="font-medium" style={{ color: "var(--color-normal)" }}>{(SEC_H.roc_auc * 100).toFixed(2)}%</span></span>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <ChartCard title="Traffic Distribution" subtitle="Secondary model test set (30,000 rows)" height="h-56">
          <AttackDistributionChart normal={24078} attack={5922} />
        </ChartCard>
        <ChartCard title="Risk Level Distribution" subtitle="High / Moderate / Low" height="h-56">
          <RiskDistributionChart high={5279} moderate={571} low={24150} />
        </ChartCard>
        <ChartCard title="Attack Categories" subtitle="CIC-IDS-2017 test set (dataset annotations)" height="h-56">
          <AttackCategoryChart data={SECONDARY_ATTACK_CATEGORIES} />
        </ChartCard>
      </div>

      {/* Timeline */}
      <ChartCard
        title="Traffic Timeline"
        subtitle="Illustrative hourly distribution (CIC-IDS-2017 training data pattern)"
        height="h-52"
        className="mb-4"
      >
        <TimelineChart data={HOURLY_DISTRIBUTION} />
      </ChartCard>

      {/* Primary attack categories */}
      <ChartCard
        title="Primary Model — Alert Categories"
        subtitle="Suricata IDS testbed Snort alert classifications (dataset annotations)"
        height="h-52"
        className="mb-4"
      >
        <AttackCategoryChart data={PRIMARY_ATTACK_CATEGORIES} horizontal={false} />
      </ChartCard>

      {/* Key findings */}
      <div
        className="rounded-xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <Zap size={15} style={{ color: "var(--color-review)" }} />
          Key Findings
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[12px]">
          {[
            { title: "Separate experiments", desc: "Each dataset has its own feature schema, model settings, and test population. Review results within their dataset context." },
            { title: "Secondary hybrid weighting", desc: "The saved CIC-IDS-2017 configuration uses w_LR=0.0 and w_RF=1.0; its hybrid score is therefore based on Random Forest alone." },
            { title: "Experiment-specific thresholds", desc: "The saved primary and secondary decision thresholds differ. Treat outputs as model estimates for research review." },
          ].map(({ title, desc }) => (
            <div key={title} className="rounded-lg border p-3" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
              <p className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
