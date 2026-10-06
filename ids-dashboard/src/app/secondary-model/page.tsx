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
const SEC_RF = SECONDARY_METRICS.find((m) => m.model_name === "Random Forest")!;
const SEC_LR = SECONDARY_METRICS.find((m) => m.model_name === "Logistic Regression")!;

const PRED_COLUMNS: Column<PredictionRow>[] = [
  { key: "id",          header: "#",        className: "w-10 text-slate-500" },
  { key: "attack_type", header: "Category", render: (r) => (
    <span className="text-xs text-slate-300">{r.attack_type ?? "—"}</span>
  )},
  { key: "lr_prob_calibrated",      header: "LR Cal",     sortable: true, render: (r) => (
    <span className="font-mono text-sky-400">{formatScore(r.lr_prob_calibrated)}</span>
  )},
  { key: "rf_prob_calibrated",      header: "RF Cal",     sortable: true, render: (r) => (
    <span className="font-mono text-orange-400">{formatScore(r.rf_prob_calibrated)}</span>
  )},
  { key: "hybrid_score_calibrated", header: "Hybrid",     sortable: true, render: (r) => (
    <span className="font-mono text-violet-400 font-semibold">{formatScore(r.hybrid_score_calibrated)}</span>
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
        badgeColor="violet"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-[#0a1628] border border-[#1e3a5f] px-3 py-1.5 rounded-lg">
          <Cpu size={11} className="text-violet-400" />
          <span>w_LR={SECONDARY_CONFIG.w_lr} · w_RF={SECONDARY_CONFIG.w_rf} · thr={SECONDARY_CONFIG.decision_threshold}</span>
        </div>
      </PageHeader>

      {/* ── Baseline metrics ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard title="Test Set Size"  value="30,000"   subtitle="Held-out test rows"    icon={<Activity size={15}/>}      accent="violet"  />
        <StatCard title="Hybrid Accuracy" value="99.86%"  subtitle="On unseen test set"    icon={<CheckCircle size={15}/>}   accent="emerald" />
        <StatCard title="Hybrid Recall"  value="99.66%"   subtitle="Attack detection rate"  icon={<Database size={15}/>}      accent="violet"  />
        <StatCard title="Missed Attacks" value={SEC_H.fn.toString()} subtitle="False negatives (FN)" icon={<AlertTriangle size={15}/>} accent="amber" />
      </div>

      {/* ── Upload section ─────────────────────────────────── */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Run Secondary Model Inference</h3>
        </div>

        {/* Required features info */}
        <div className="mb-4 rounded-lg bg-violet-500/5 border border-violet-500/15 p-3">
          <div className="flex items-start gap-2">
            <Info size={13} className="text-violet-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-violet-300 mb-1">Required CSV Columns (12 features)</p>
              <div className="flex flex-wrap gap-1">
                {SECONDARY_FEATURE_COLS.map((f) => (
                  <code key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 font-mono">
                    {f}
                  </code>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Compatibility warning */}
        <div className="mb-4 rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-1">Training Data Compatibility</p>
              <p className="text-[11px] text-amber-200/70 leading-relaxed">
                This model was trained on CIC-IDS-2017 statistics. Attack flows have{" "}
                <strong className="text-amber-300">bytes_per_packet median = 6</strong> and{" "}
                <strong className="text-amber-300">total_bytes median = 30</strong>. CSV rows with
                large byte values (500–1500 bytes/pkt) will be classified as Normal — this is
                correct model behaviour. Use <code className="text-amber-300">test_data_model_compatible.csv</code> as a reference template.
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
            <ChartCard title="Hybrid Score Distribution" subtitle={`Decision threshold = ${SECONDARY_CONFIG.decision_threshold}`} height="h-52">
              <ProbabilityHistogram threshold={SECONDARY_CONFIG.decision_threshold} />
            </ChartCard>
          </div>

          {/* Prediction table */}
          <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
            <p className="text-sm font-semibold text-white mb-4">Prediction Details</p>
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
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BookOpen size={15} className="text-slate-400" /> Baseline Model Performance (30,000 test rows)
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
      <div className="mt-6 rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5">
        <p className="text-sm font-semibold text-white mb-3">Secondary Model Configuration</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-400">
          <div>
            <p className="font-semibold text-slate-300 mb-2">Hybrid Formula</p>
            <code className="block bg-[#0f1f3d] rounded-lg p-3 text-[11px] text-slate-300 leading-relaxed font-mono">
              {"Hybrid = 0.00 × LR_cal + 1.00 × RF_cal"}<br/>
              {"       = RF calibrated probability"}<br/>
              {"Decision: score ≥ 0.4536 → Attack"}<br/>
              {"High Risk:     score ≥ 0.70"}<br/>
              {"Moderate Risk: 0.40 ≤ score < 0.70"}<br/>
              {"Low Risk:      score < 0.40"}
            </code>
          </div>
          <div>
            <p className="font-semibold text-slate-300 mb-2">Training Details</p>
            <div className="space-y-1">
              {[
                ["Dataset",        SECONDARY_MODEL_CONFIG.dataset],
                ["Train rows",     SECONDARY_MODEL_CONFIG.n_train.toLocaleString()],
                ["Calibration",    SECONDARY_MODEL_CONFIG.n_val.toLocaleString()],
                ["Val (tuning)",   "10,504"],
                ["Test rows",      SECONDARY_MODEL_CONFIG.n_test.toLocaleString()],
                ["Calibration method", "Isotonic regression"],
                ["RF trees",       "300"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-slate-300 font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
