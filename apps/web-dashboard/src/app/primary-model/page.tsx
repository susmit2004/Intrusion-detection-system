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
import ProbabilityHistogram from "@/components/charts/ProbabilityHistogram";
import {
  Shield, Activity, AlertTriangle, CheckCircle,
  Info, BookOpen, Cpu,
} from "lucide-react";
import {
  PRIMARY_METRICS, PRIMARY_FEATURE_IMPORTANCE,
  PRIMARY_MODEL_CONFIG,
} from "@/lib/mockData";
import { predictCSV } from "@/services/apiService";
import { PRIMARY_FEATURE_COLS, PRIMARY_CONFIG } from "@/lib/constants";
import type { InferenceResponse, PredictionRow } from "@/types";
import { formatScore } from "@/lib/utils";

const PRI_H  = PRIMARY_METRICS.find((m) => m.model_name === "Hybrid Model")!;

const PRED_COLUMNS: Column<PredictionRow>[] = [
  { key: "id",          header: "#",        className: "w-10 text-[var(--text-muted)]" },
  { key: "attack_type", header: "Category", render: (r) => (
    <span className="text-xs text-[var(--text-secondary)]">{r.attack_type ?? "—"}</span>
  )},
  { key: "lr_prob_calibrated", header: "LR Prob", sortable: true, render: (r) => (
    <span className="font-mono text-[var(--model-lr)]">{formatScore(r.lr_prob_calibrated)}</span>
  )},
  { key: "rf_prob_calibrated", header: "RF Prob", sortable: true, render: (r) => (
    <span className="font-mono text-[var(--color-normal)]">{formatScore(r.rf_prob_calibrated)}</span>
  )},
  { key: "hybrid_score_calibrated", header: "Hybrid Score", sortable: true, render: (r) => (
    <span className="font-mono text-[var(--accent)] font-semibold">{formatScore(r.hybrid_score_calibrated)}</span>
  )},
  { key: "prediction", header: "Prediction", render: (r) => (
    <PredictionBadge prediction={r.prediction} size="sm" />
  )},
  { key: "risk_level", header: "Risk Level", render: (r) => (
    <RiskBadge level={r.risk_level} size="sm" />
  )},
  { key: "correct", header: "Correct?", render: (r) => r.correct !== undefined ? (
    <span className={r.correct ? "text-[var(--color-normal)] text-xs" : "text-[var(--color-attack)] text-xs"}>
      {r.correct ? "✓" : "✗"}
    </span>
  ) : <span className="text-[var(--text-muted)] text-xs">—</span> },
];

export default function PrimaryModelPage() {
  const [result, setResult] = useState<InferenceResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const resp = await predictCSV(file, "primary");
      setResult(resp);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <DashboardLayout title="Primary Model" subtitle="Suricata IDS Testbed · 22-feature network flow analysis">
      <PageHeader
        title="Primary Model"
        subtitle="Suricata-based intrusion detection on testbed network traffic"
        badge="22 Features · Testbed Dataset"
        badgeColor="lime"
      >
        <div className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <Cpu size={11} style={{ color: "var(--accent)" }} />
          <span>w_LR={PRIMARY_CONFIG.w_lr} · w_RF={PRIMARY_CONFIG.w_rf} · thr={PRIMARY_CONFIG.decision_threshold}</span>
        </div>
      </PageHeader>

      <p className="mb-4 text-xs text-[var(--text-secondary)]">
        Saved experiment metrics are historical references; results from your current CSV upload appear below.
      </p>

      {/* ── Baseline metrics ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Test Set Size"  value="3,607"   subtitle="Saved experiment metadata" icon={<Activity size={15}/>}    accent="blue"    />
        <StatCard title="Hybrid Accuracy" value="97.59%" subtitle="Saved test-set result · reference"  icon={<CheckCircle size={15}/>} accent="emerald" />
        <StatCard title="Hybrid Recall"  value="97.79%" subtitle="Attack detection rate" icon={<Shield size={15}/>}     accent="blue"    />
        <StatCard title="Missed Attacks" value={PRI_H.fn.toString()} subtitle="False negatives" icon={<AlertTriangle size={15}/>} accent="amber" />
      </div>

      {/* ── Upload section ─────────────────────────────────── */}
      <div className="rounded-xl border p-5 mb-6" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Run Primary Model Inference</h3>
        </div>

        {/* Required features info */}
        <div className="mb-4 rounded-lg border p-3" style={{ background: "color-mix(in srgb, var(--accent) 5%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 15%, transparent)" }}>
          <div className="flex items-start gap-2">
            <Info size={13} style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--accent)" }}>Required CSV Columns (22 features)</p>
              <div className="flex flex-wrap gap-1">
                {PRIMARY_FEATURE_COLS.map((f) => (
                  <code key={f} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                    {f}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>

        <FileUpload model="primary" onFile={handleFile} loading={loading} />
      </div>

      {/* ── Results ────────────────────────────────────────── */}
      {result && (
        <div className="space-y-6">
          <PredictionCard
            summary={result.summary}
            modelLabel="Primary Model"
            processingMs={result.processing_time_ms}
            hybridWeight={{ w_lr: PRIMARY_CONFIG.w_lr, w_rf: PRIMARY_CONFIG.w_rf }}
            threshold={PRIMARY_CONFIG.decision_threshold}
          />

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Traffic Split" height="h-52">
              <AttackDistributionChart normal={result.summary.normal_count} attack={result.summary.attack_count} />
            </ChartCard>
            <ChartCard title="Risk Distribution" height="h-52">
              <RiskDistributionChart high={result.summary.high_risk} moderate={result.summary.moderate_risk} low={result.summary.low_risk} />
            </ChartCard>
            <ChartCard title="Score Distribution (illustrative)" subtitle={`Threshold = ${PRIMARY_CONFIG.decision_threshold} — chart is illustrative only`} height="h-52">
              <ProbabilityHistogram threshold={PRIMARY_CONFIG.decision_threshold} />
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
              downloadName="primary_predictions.csv"
            />
          </div>
        </div>
      )}

      {/* ── Baseline confusion matrices ─────────────────────── */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
          <BookOpen size={15} style={{ color: "var(--text-muted)" }} /> Baseline Model Performance (3,607 test rows)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {PRIMARY_METRICS.map((m) => (
            <ConfusionMatrix key={m.model_name} tp={m.tp} tn={m.tn} fp={m.fp} fn={m.fn} modelName={m.model_name} />
          ))}
        </div>
      </div>

      {/* ── Feature importance ──────────────────────────────── */}
      <FeatureImportance items={PRIMARY_FEATURE_IMPORTANCE} title="Primary RF Feature Importance" maxItems={12} />

      {/* ── Hybrid config note ──────────────────────────────── */}
      <div className="mt-6 rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Primary Model Configuration</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div>
            <p className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Hybrid Formula</p>
            <code className="block rounded-lg p-3 text-[11px] leading-relaxed font-mono" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
              {"Hybrid = 0.30 × LR_cal + 0.70 × RF_cal"}<br/>
              {"Decision: score ≥ 0.5025 → Attack"}<br/>
              {"High Risk: score ≥ 0.70"}<br/>
              {"Low Risk:  score < 0.40"}
            </code>
          </div>
          <div>
            <p className="font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Training Details</p>
            <div className="space-y-1">
              {[
                ["Dataset",       PRIMARY_MODEL_CONFIG.dataset],
                ["Train rows",    PRIMARY_MODEL_CONFIG.n_train.toLocaleString()],
                ["Val rows",      PRIMARY_MODEL_CONFIG.n_val.toLocaleString()],
                ["Test rows",     PRIMARY_MODEL_CONFIG.n_test.toLocaleString()],
                ["Calibration",   PRIMARY_MODEL_CONFIG.hybrid.calibration_method],
                ["RF trees",      "300"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
