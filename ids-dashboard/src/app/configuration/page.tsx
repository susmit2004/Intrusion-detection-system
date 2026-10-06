"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import { Settings, Shield, Database, Cpu, Info } from "lucide-react";
import { PRIMARY_MODEL_CONFIG, SECONDARY_MODEL_CONFIG } from "@/lib/mockData";
import { PRIMARY_CONFIG, SECONDARY_CONFIG, PRIMARY_FEATURE_COLS, SECONDARY_FEATURE_COLS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] overflow-hidden mb-5">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1e3a5f] bg-[#0f1f3d]">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function KV({ k, v, mono = false, color }: { k: string; v: string; mono?: boolean; color?: string }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-[#1e3a5f]/40 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-48">{k}</span>
      <span className={cn("text-xs text-right", mono ? "font-mono" : "font-medium", color ?? "text-slate-300")}>
        {v}
      </span>
    </div>
  );
}

export default function ConfigurationPage() {
  return (
    <DashboardLayout title="Configuration" subtitle="Experiment parameters, model config, and system information">
      <PageHeader
        title="Configuration"
        subtitle="All parameters used for model training, calibration, and inference — confirmed from experiment artifacts"
        badge="Read-Only · From experiment_config.json"
        badgeColor="amber"
      >
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-[#0a1628] border border-[#1e3a5f] px-3 py-1.5 rounded-lg">
          <Settings size={11} className="text-slate-400" />
          <span>No retraining from this UI</span>
        </div>
      </PageHeader>

      {/* ── API status ─────────────────────────────────────── */}
      <Section title="API & Service Configuration" icon={<Cpu size={15} />}>
        <KV k="API Mode"            v="Mock (NEXT_PUBLIC_API_URL not set)" color="text-amber-400" />
        <KV k="Backend base URL"    v="http://localhost:8000" mono />
        <KV k="Primary endpoint"    v="POST /api/primary/predict" mono />
        <KV k="Secondary endpoint"  v="POST /api/secondary/predict" mono />
        <KV k="Config endpoint"     v="GET /api/{model}/config" mono />
        <div className="mt-3 rounded-lg bg-amber-500/5 border border-amber-500/15 p-3 flex gap-2">
          <Info size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-200/70">
            To connect to the real ML backend, set{" "}
            <code className="text-amber-300">NEXT_PUBLIC_API_URL=http://localhost:8000</code> in{" "}
            <code className="text-amber-300">.env.local</code> and restart the dev server.
            The frontend will automatically switch from mock mode to live API calls.
          </p>
        </div>
      </Section>

      {/* ── Primary model ─────────────────────────────────── */}
      <Section title="Primary Model Configuration (Suricata Testbed)" icon={<Shield size={15} className="text-blue-400" />}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Dataset & Splits</p>
            <KV k="Dataset"            v={PRIMARY_MODEL_CONFIG.dataset} />
            <KV k="Train rows"         v={PRIMARY_MODEL_CONFIG.n_train.toLocaleString()} mono />
            <KV k="Validation rows"    v={PRIMARY_MODEL_CONFIG.n_val.toLocaleString()}   mono />
            <KV k="Test rows"          v={PRIMARY_MODEL_CONFIG.n_test.toLocaleString()}   mono />
            <KV k="Split method"       v="Time-based (last 15% of training rows)" />
            <KV k="Random seed"        v="42" mono />
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">Hybrid Config</p>
            <KV k="w_LR"               v={PRIMARY_CONFIG.w_lr.toString()} mono color="text-sky-400" />
            <KV k="w_RF"               v={PRIMARY_CONFIG.w_rf.toString()} mono color="text-orange-400" />
            <KV k="Decision threshold" v={PRIMARY_CONFIG.decision_threshold.toString()} mono color="text-violet-400" />
            <KV k="Low triage thr."    v={PRIMARY_CONFIG.low_triage_threshold.toString()} mono />
            <KV k="High triage thr."   v={PRIMARY_CONFIG.high_triage_threshold.toString()} mono />
            <KV k="Calibration method" v={PRIMARY_MODEL_CONFIG.hybrid.calibration_method} />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">LR Parameters</p>
            {Object.entries(PRIMARY_MODEL_CONFIG.lr_params).map(([k, v]) => (
              <KV key={k} k={k} v={String(v)} mono />
            ))}
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">RF Parameters</p>
            {Object.entries(PRIMARY_MODEL_CONFIG.rf_params).map(([k, v]) => (
              <KV key={k} k={k} v={String(v)} mono />
            ))}
          </div>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">22 Input Features</p>
        <div className="flex flex-wrap gap-1.5">
          {PRIMARY_FEATURE_COLS.map((f) => (
            <code key={f} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/15 text-blue-300 font-mono">
              {f}
            </code>
          ))}
        </div>
      </Section>

      {/* ── Secondary model ─────────────────────────────────── */}
      <Section title="Secondary Model Configuration (CIC-IDS-2017)" icon={<Database size={15} className="text-violet-400" />}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Dataset & Splits</p>
            <KV k="Dataset"              v={SECONDARY_MODEL_CONFIG.dataset} />
            <KV k="Train rows"           v={SECONDARY_MODEL_CONFIG.n_train.toLocaleString()} mono />
            <KV k="Calibration rows"     v="10,443" mono />
            <KV k="Tuning (val) rows"    v={SECONDARY_MODEL_CONFIG.n_val.toLocaleString()} mono />
            <KV k="Test rows"            v={SECONDARY_MODEL_CONFIG.n_test.toLocaleString()} mono />
            <KV k="Split method"         v="Feature-group-stratified 70/15/15" />
            <KV k="Random seed"          v="42" mono />
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">Hybrid Config</p>
            <KV k="w_LR"                 v={SECONDARY_CONFIG.w_lr.toString()} mono color="text-sky-400" />
            <KV k="w_RF"                 v={SECONDARY_CONFIG.w_rf.toString()} mono color="text-orange-400" />
            <KV k="Decision threshold"   v={SECONDARY_CONFIG.decision_threshold.toString()} mono color="text-violet-400" />
            <KV k="Low triage thr."      v={SECONDARY_CONFIG.low_triage_threshold.toString()} mono />
            <KV k="High triage thr."     v={SECONDARY_CONFIG.high_triage_threshold.toString()} mono />
            <KV k="Calibration method"   v={SECONDARY_MODEL_CONFIG.hybrid.calibration_method} />
            <KV k="Note on w_LR=0"       v="Grid search found RF alone maximises F1 on validation set" color="text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">LR Parameters</p>
            {Object.entries(SECONDARY_MODEL_CONFIG.lr_params).map(([k, v]) => (
              <KV key={k} k={k} v={String(v)} mono />
            ))}
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">RF Parameters</p>
            {Object.entries(SECONDARY_MODEL_CONFIG.rf_params).map(([k, v]) => (
              <KV key={k} k={k} v={String(v)} mono />
            ))}
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">Risk Thresholds</p>
            <KV k="High Risk threshold"     v="≥ 0.70"  mono color="text-red-400"     />
            <KV k="Moderate Risk threshold" v="≥ 0.40"  mono color="text-amber-400"   />
            <KV k="Low Risk threshold"      v="< 0.40"  mono color="text-emerald-400" />
          </div>
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 mt-4">12 Input Features</p>
        <div className="flex flex-wrap gap-1.5">
          {SECONDARY_FEATURE_COLS.map((f) => (
            <code key={f} className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/15 text-violet-300 font-mono">
              {f}
            </code>
          ))}
        </div>
      </Section>

      {/* ── Data leakage note ──────────────────────────────── */}
      <Section title="Data Leakage Prevention" icon={<Info size={15} className="text-emerald-400" />}>
        <p className="text-[12px] text-slate-400 leading-relaxed mb-3">
          The following columns are automatically stripped from any uploaded CSV before inference.
          Feeding label or prediction columns as model inputs would constitute data leakage and
          produce artificially perfect results. The frontend enforces this even when the backend API is live.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["Label","Attack Type","Risk Level","label_binary","model_prediction","triage_level",
            "hybrid_score","lr_prob_raw","rf_prob_raw","true_binary","alert_signature",
            "alert_category","flow_id","src_ip","dest_ip"].map((col) => (
            <code key={col} className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/15 text-red-300 font-mono">
              {col}
            </code>
          ))}
        </div>
      </Section>
    </DashboardLayout>
  );
}
