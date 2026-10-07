"use client";

import { useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ChartCard from "@/components/ui/ChartCard";
import FileUpload from "@/components/ml/FileUpload";
import PredictionCard from "@/components/ml/PredictionCard";
import ConfusionMatrix from "@/components/ml/ConfusionMatrix";
import FeatureImportance from "@/components/ml/FeatureImportance";
import DataTable, { Column } from "@/components/ui/DataTable";
import { RiskBadge, PredictionBadge } from "@/components/ui/RiskBadge";
import AttackDistributionChart from "@/components/charts/AttackDistributionChart";
import RiskDistributionChart from "@/components/charts/RiskDistributionChart";
import AttackCategoryChart from "@/components/charts/AttackCategoryChart";
import ProbabilityHistogram from "@/components/charts/ProbabilityHistogram";
import {
  Database, Activity, AlertTriangle, CheckCircle,
  Info, BookOpen, Cpu, AlertCircle,
} from "lucide-react";
import {
  SECONDARY_METRICS, SECONDARY_FEATURE_IMPORTANCE,
  SECONDARY_MODEL_CONFIG, SECONDARY_ATTACK_CATEGORIES,
} from "@/lib/mockData";
import { predictCSV } from "@/services/apiService";
import { SECONDARY_FEATURE_COLS, SECONDARY_CONFIG } from "@/lib/constants";
import type { InferenceResponse, PredictionRow } from "@/types";
import { formatScore } from "@/lib/utils";

const SEC_H  = SECONDARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;

const PRED_COLUMNS: Column<PredictionRow>[] = [
  { key: "id",          header: "#",        className: "w-10 text-[var(--text-muted)]" },
  { key: "attack_type", header: "Category", render: (r) => (
    <span className="text-xs text-[var(--text-secondary)]">{r.attack_type ?? "—"}</span>
  )},
  { key: "lr_prob_calibrated",      header: "LR Cal",     sortable: true, render: (r) => (
    <span className="font-mono text-[var(--model-lr)]">{formatScore(r.lr_prob_calibrated)}</span>
  )},
  { key: "rf_prob_calibrated",      header: "RF Cal",     sortable: true, render: (r) => (
    <span className="font-mono text-[var(--color-normal)]">{formatScore(r.rf_prob_calibrated)}</span>
  )},
  { key: "hybrid_score_calibrated", header: "Hybrid",     sortable: true, render: (r) => (
    <span className="font-mono text-[var(--accent)] font-semibold">{formatScore(r.hybrid_score_calibrated)}</span>
  )},
  { key: "prediction",  header: "Prediction", render: (r) => (
    <PredictionBadge prediction={r.prediction} size="sm" />
  )},
  { key: "risk_level",  header: "Risk Level", render: (r) => (
    <RiskBadge level={r.risk_level} size="sm" />
  )},
];

export default function SecondaryModelPage() {
  const [result, setResult] = useState<InferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await predictCSV(file, "secondary");
      setResult(resp);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DashboardLayout title="Secondary Model" subtitle="CIC-IDS-2017 · 12-feature network flow analysis">
      <PageHeader
        title="Secondary Model"
        subtitle="CIC-IDS-2017 network flow intrusion detection (Canadian Institute for Cybersecurity)"
        badge="12 Features · CIC-IDS-2017"
        badgeColor="teal"
      >
        <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <Cpu size={11} style={{ color: "var(--color-normal)" }} />
          <span>w_LR={SECONDARY_CONFIG.w_lr} · w_RF={SECONDARY_CONFIG.w_rf} · thr={SECONDARY_CONFIG.decision_threshold}</span>
        </div>
      </PageHeader>

      <p className="mb-4 text-xs text-[var(--text-secondary)]">
        Saved experiment metrics are historical references; results from your current CSV upload appear below.
      </p>

      {/* ── Baseline metrics ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Test Set Size"  value="30,000"   subtitle="Saved experiment metadata"    icon={<Activity size={15}/>}      accent="violet"  />
        <StatCard title="Hybrid Accuracy" value="99.86%"  subtitle="Saved test-set result · reference"    icon={<CheckCircle size={15}/>}   accent="emerald" />
        <StatCard title="Hybrid Recall"  value="99.66%"   subtitle="Attack detection rate"  icon={<Database size={15}/>}      accent="violet"  />
        <StatCard title="Missed Attacks" value={SEC_H.fn.toString()} subtitle="False negatives (FN)" icon={<AlertTriangle size={15}/>} accent="amber" />
      </div>

      {/* ── Upload section ─────────────────────────────────── */}
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} style={{ color: "var(--color-normal)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Run Secondary Model Inference</h3>
        </div>

        {/* Required features info */}
        <div className="mb-4 rounded-lg border p-3" style={{ background: "color-mix(in srgb, var(--color-normal) 5%, transparent)", borderColor: "color-mix(in srgb, var(--color-normal) 15%, transparent)" }}>
          <div className="flex items-start gap-2">
            <Info size={13} style={{ color: "var(--color-normal)" }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-normal)" }}>Required CSV Columns (12 features)</p>
              <div className="flex flex-wrap gap-1">
                {SECONDARY_FEATURE_COLS.map((f) => (
                  <code key={f} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "color-mix(in srgb, var(--color-normal) 10%, transparent)", color: "var(--color-normal)" }}>
                    {f}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Compatibility warning */}
        <div className="mb-4 rounded-lg border p-3" style={{ background: "color-mix(in srgb, var(--color-review) 5%, transparent)", borderColor: "color-mix(in srgb, var(--color-review) 15%, transparent)" }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={13} style={{ color: "var(--color-review)" }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-review)" }}>Dataset Compatibility</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-review)", opacity: 0.8 }}>
                This pipeline expects the CIC-IDS-2017 feature schema and compatible preprocessing. Inputs from another source may use different feature distributions; check the required columns and dataset context before interpreting scores.
              </p>
            </div>
          </div>
        </div>

        <FileUpload model="secondary" onFile={handleFile} loading={loading} />
      </div>

      {/* ── Results ────────────────────────────────────────── */}
      {result && (
        <div className="space-y-6">
          <PredictionCard
            summary={result.summary}
            modelLabel="Secondary Model"
            processingMs={result.processing_time_ms}
            hybridWeight={{ w_lr: SECONDARY_CONFIG.w_lr, w_rf: SECONDARY_CONFIG.w_rf }}
            threshold={SECONDARY_CONFIG.decision_threshold}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Traffic Split" height="h-52">
              <AttackDistributionChart normal={result.summary.normal_count} attack={result.summary.attack_count} />
            </ChartCard>
            <ChartCard title="Risk Distribution" height="h-52">
              <RiskDistributionChart high={result.summary.high_risk} moderate={result.summary.moderate_risk} low={result.summary.low_risk} />
            </ChartCard>
            <ChartCard title="Score Distribution (illustrative)" subtitle={`Threshold = ${SECONDARY_CONFIG.decision_threshold} — chart is illustrative only`} height="h-52">
              <ProbabilityHistogram threshold={SECONDARY_CONFIG.decision_threshold} />
            </ChartCard>
          </div>

          {/* Prediction table */}
          <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Prediction Details</p>
            <DataTable
              columns={PRED_COLUMNS}
              data={result.rows}
              pageSize={10}
              searchable
              searchKeys={["attack_type", "prediction", "risk_level"] as (keyof PredictionRow)[]}
              downloadable
              downloadName="secondary_predictions.csv"
            />
          </div>
        </div>
      )}

      {/* ── Baseline confusion matrices ─────────────────────── */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <BookOpen size={15} style={{ color: "var(--text-muted)" }} /> Baseline Model Performance (30,000 test rows)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {SECONDARY_METRICS.map((m) => (
            <ConfusionMatrix key={m.model_name} tp={m.tp} tn={m.tn} fp={m.fp} fn={m.fn} modelName={m.model_name} />
          ))}
        </div>
      </div>

      {/* ── Attack categories ──────────────────────────────── */}
      <ChartCard title="Attack Category Distribution" subtitle="CIC-IDS-2017 test set breakdown" height="h-64" className="mb-6">
        <AttackCategoryChart data={SECONDARY_ATTACK_CATEGORIES} />
      </ChartCard>

      {/* ── Feature importance ──────────────────────────────── */}
      <FeatureImportance items={SECONDARY_FEATURE_IMPORTANCE} title="Secondary RF Feature Importance" maxItems={12} />

      {/* ── Config note ─────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Secondary Model Configuration</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div>
            <p className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Hybrid Formula</p>
            <code className="block rounded-lg p-3 text-[11px] leading-relaxed font-mono" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              {"Hybrid = 0.00 × LR_cal + 1.00 × RF_cal"}<br/>
              {"       = RF calibrated probability"}<br/>
              {"Decision: score ≥ 0.4536 → Attack"}<br/>
              {"High Risk:     score ≥ 0.70"}<br/>
              {"Moderate Risk: 0.40 ≤ score < 0.70"}<br/>
              {"Low Risk:      score < 0.40"}
            </code>
          </div>
          <div>
            <p className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Training Details</p>
            <div className="space-y-1">
              {[
                ["Dataset",            SECONDARY_MODEL_CONFIG.dataset],
                ["Train rows",         SECONDARY_MODEL_CONFIG.n_train.toLocaleString()],
                ["Calibration",        SECONDARY_MODEL_CONFIG.n_val.toLocaleString()],
                ["Val (tuning)",        "10,504"],
                ["Test rows",          SECONDARY_MODEL_CONFIG.n_test.toLocaleString()],
                ["Calibration method", "Isotonic regression"],
                ["RF trees",           "300"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span className="font-medium text-right" style={{ color: "var(--text-secondary)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
