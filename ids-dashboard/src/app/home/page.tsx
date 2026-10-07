"use client";

import Link from "next/link";
import {
  Shield,
  LayoutDashboard,
  Database,
  GitMerge,
  GitCompare,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

// ── Workflow step component ────────────────────────────────────────────────
function WorkflowStep({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-3 rounded-lg border text-center min-w-[120px]"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-panel)" }}
    >
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {label}
      </span>
      {sub && (
        <span className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <ArrowRight
      size={16}
      className="shrink-0"
      style={{ color: "var(--accent)" }}
    />
  );
}

// ── Experiment card ────────────────────────────────────────────────────────
interface ExperimentCardProps {
  tag: string;
  dataset: string;
  features: string;
  testRows: string;
  f1: string;
  accuracy: string;
  note: string;
  accentColor: string;
}

function ExperimentCard({
  tag,
  dataset,
  features,
  testRows,
  f1,
  accuracy,
  note,
  accentColor,
}: ExperimentCardProps) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-panel)" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
          style={{
            color: accentColor,
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          }}
        >
          {tag}
        </span>
      </div>
      <div className="space-y-2">
        <MetricRow label="Dataset" value={dataset} />
        <MetricRow label="Features" value={features} />
        <MetricRow label="Test Rows" value={testRows} />
        <MetricRow label="Hybrid F1" value={f1} accent={accentColor} />
        <MetricRow label="Hybrid Accuracy" value={accuracy} accent={accentColor} />
      </div>
      <p
        className="text-[11px] leading-relaxed border-t pt-3"
        style={{ color: "var(--text-secondary)", borderColor: "var(--border-color)" }}
      >
        {note}
      </p>
    </div>
  );
}

function MetricRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span
        className="text-xs font-semibold tabular-nums"
        style={{ color: accent ?? "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Triage level card ─────────────────────────────────────────────────────
function TriageCard({
  icon,
  label,
  range,
  description,
  colorVar,
}: {
  icon: React.ReactNode;
  label: string;
  range: string;
  description: string;
  colorVar: string;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        borderColor: `color-mix(in srgb, ${colorVar} 30%, var(--border-color))`,
        background: `color-mix(in srgb, ${colorVar} 6%, var(--bg-panel))`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: colorVar }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: colorVar }}>
          {label}
        </span>
      </div>
      <span className="text-[11px] font-mono" style={{ color: colorVar }}>
        {range}
      </span>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {description}
      </p>
    </div>
  );
}

// ── Navigation button ──────────────────────────────────────────────────────
function NavButton({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 border"
      style={
        primary
          ? {
              background: "var(--accent)",
              color: "#0B1120",
              borderColor: "var(--accent)",
            }
          : {
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              color: "var(--text-primary)",
              borderColor: "var(--border-color)",
            }
      }
    >
      {icon}
      {label}
    </Link>
  );
}

// ── Section heading ────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-base font-semibold mb-4"
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </h2>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">

        {/* ── Header ── */}
        <section className="space-y-4">
          <div
            className="inline-block text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded"
            style={{
              color: "var(--accent)",
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
            }}
          >
            MCA Research Project
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            This project develops a hybrid intrusion detection system that combines Logistic Regression
            and Random Forest through calibrated probability weighting to improve SOC alert triage
            accuracy. Probability outputs from both models are calibrated with isotonic regression,
            then merged into a single hybrid score used to classify and rank network traffic alerts.
            The goal is to reduce both false negatives (missed attacks) and alert fatigue for SOC analysts.
          </p>
        </section>

        {/* ── Approach ── */}
        <section>
          <SectionHeading>Implemented Approach</SectionHeading>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
            Logistic Regression (LR) and Random Forest (RF) are trained independently on network-flow
            features. Each model&rsquo;s raw probability is calibrated with isotonic regression. The hybrid
            score is computed as{" "}
            <code
              className="text-[11px] px-1.5 py-0.5 rounded font-mono"
              style={{
                background: "var(--bg-panel)",
                color: "var(--accent)",
                border: "1px solid var(--border-color)",
              }}
            >
              w_LR × LR_cal + w_RF × RF_cal
            </code>
            , where weights are chosen by grid search to maximise F1 on a validation set.
          </p>

          {/* Workflow diagram */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "var(--border-color)", background: "var(--bg-panel)" }}
          >
            <p
              className="text-[10px] uppercase tracking-widest font-semibold mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Workflow
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <WorkflowStep label="Traffic Features" sub="22 or 12 cols" />
              <Arrow />
              <div className="flex flex-col gap-2">
                <WorkflowStep label="Logistic Regression" sub="calibrated" />
                <WorkflowStep label="Random Forest" sub="calibrated" />
              </div>
              <Arrow />
              <WorkflowStep label="Hybrid Score" sub="w_LR + w_RF = 1" />
              <Arrow />
              <WorkflowStep label="SOC Triage" sub="3 levels" />
            </div>
          </div>
        </section>

        {/* ── Experiments ── */}
        <section>
          <SectionHeading>Experiments</SectionHeading>
          <div className="grid sm:grid-cols-2 gap-4">
            <ExperimentCard
              tag="Primary"
              dataset="Suricata IDS Testbed"
              features="22 network-flow features"
              testRows="3,607"
              f1="0.9853"
              accuracy="97.59%"
              note="LR and RF both contribute; w_LR=0.30, w_RF=0.70 from grid search. Threshold=0.5025."
              accentColor="var(--accent)"
            />
            <ExperimentCard
              tag="Secondary"
              dataset="CIC-IDS-2017"
              features="12 network-flow features"
              testRows="30,000"
              f1="0.9965"
              accuracy="99.86%"
              note="RF dominates (w_RF=1.0); LR adds no useful signal on 12-feature set. Threshold=0.4536."
              accentColor="#8b5cf6"
            />
          </div>
        </section>

        {/* ── Triage levels ── */}
        <section>
          <SectionHeading>Triage Levels</SectionHeading>
          <div className="grid sm:grid-cols-3 gap-4">
            <TriageCard
              icon={<ShieldAlert size={16} />}
              label="High Suspicion"
              range="score ≥ 0.70"
              description="Probable attack with high model confidence. Immediate SOC investigation required."
              colorVar="var(--color-attack)"
            />
            <TriageCard
              icon={<AlertTriangle size={16} />}
              label="Review"
              range="0.40 ≤ score < 0.70"
              description="Possible attack, lower confidence. Analyst review recommended."
              colorVar="var(--color-review)"
            />
            <TriageCard
              icon={<CheckCircle size={16} />}
              label="Low Suspicion"
              range="score < 0.40"
              description="Likely normal traffic. Log and monitor; no immediate action needed."
              colorVar="var(--color-normal)"
            />
          </div>
        </section>

        {/* ── Navigation links ── */}
        <section>
          <SectionHeading>Explore the Dashboard</SectionHeading>
          <div className="flex flex-wrap gap-3">
            <NavButton
              href="/overview"
              icon={<LayoutDashboard size={14} />}
              label="Dashboard Overview"
              primary
            />
            <NavButton
              href="/primary-model"
              icon={<Shield size={14} />}
              label="Primary Model"
            />
            <NavButton
              href="/secondary-model"
              icon={<Database size={14} />}
              label="Secondary Model"
            />
            <NavButton
              href="/ensemble"
              icon={<GitMerge size={14} />}
              label="Ensemble Analysis"
            />
            <NavButton
              href="/comparison"
              icon={<GitCompare size={14} />}
              label="Model Comparison"
            />
          </div>
        </section>

        {/* ── Technology stack ── */}
        <section>
          <SectionHeading>Technology Stack</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {[
              "Next.js 16",
              "TypeScript",
              "Tailwind CSS v4",
              "Python scikit-learn",
              "Recharts",
            ].map((tech) => (
              <span
                key={tech}
                className="text-xs px-3 py-1 rounded-full border font-medium"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-secondary)",
                  background: "var(--bg-panel)",
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
