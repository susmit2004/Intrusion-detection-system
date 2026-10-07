"use client";

import { useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/ui/PageHeader";
import EnsembleUpload, { type EnsembleConfig } from "@/components/ml/EnsembleUpload";
import EnsembleResults from "@/components/ml/EnsembleResults";
import { predictEnsemble } from "@/services/apiService";
import type { EnsembleApiResponse } from "@/lib/ensembleData";
import { ENSEMBLE_COLUMNS, COLUMN_MODEL, COLUMN_DOCS } from "@/lib/ensembleData";
import { downloadCSV } from "@/lib/utils";
import {
  GitMerge, Download, Info, Shield, Database,
  ChevronDown, ChevronUp, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generate_template_data } from "@/lib/templateHelper";

export default function EnsemblePage() {
  const [result,  setResult]  = useState<EnsembleApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const handleSubmit = useCallback(async (file: File, config: EnsembleConfig) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await predictEnsemble(file, config);
      setResult(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ensemble inference failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadTemplate = () => {
    const data = generate_template_data();
    downloadCSV(data, "ensemble_template.csv");
  };

  return (
    <DashboardLayout
      title="Ensemble Analysis"
      subtitle="Primary + Secondary models combined via weighted scoring"
    >
      <PageHeader
        title="Ensemble Analysis"
        subtitle="Upload a single CSV containing all 34 features to run both models simultaneously and combine their outputs into one ensemble score."
        badge="34 Columns · Primary + Secondary"
        badgeColor="violet"
      >
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-[var(--color-normal)]/10 border border-[var(--color-normal)]/20 text-[var(--color-normal)] hover:bg-[var(--color-normal)]/20 transition-colors font-medium"
        >
          <Download size={13} />
          Download Template CSV
        </button>
      </PageHeader>

      {/* ── How it works ─────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info size={14} className="text-[var(--accent)]" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">How Ensemble Mode Works</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px]">
          {[
            {
              icon: <Shield size={15} className="text-[var(--accent)]" />,
              title: "Step 1 — Primary Model",
              desc: "Runs the primary pipeline on its 22 Suricata testbed features and returns its model score.",
            },
            {
              icon: <Database size={15} className="text-[var(--color-normal)]" />,
              title: "Step 2 — Secondary Model",
              desc: "Runs the secondary pipeline on its 12 CIC-IDS-2017 features and returns its model score.",
            },
            {
              icon: <GitMerge size={15} className="text-[var(--color-normal)]" />,
              title: "Step 3 — Weighted Ensemble",
              desc: "ensemble = w_primary × primary_score + w_secondary × secondary_score. Classification and risk applied to the ensemble score.",
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] p-3">
              <div className="flex items-center gap-2 mb-2">{icon}<span className="font-semibold text-[var(--text-primary)] text-xs">{title}</span></div>
              <p className="text-[var(--text-secondary)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-amber-500/5 border border-amber-500/15 p-3">
          <p className="text-[11px] text-[var(--color-review)] leading-relaxed">
            <span className="text-[var(--color-review)] font-semibold">Important: </span>
            The 5 shared column names (<code className="text-[var(--color-review)]">bytes_per_packet</code>,{" "}
            <code className="text-[var(--color-review)]">total_bytes</code>, <code className="text-[var(--color-review)]">total_packets</code>,{" "}
            <code className="text-[var(--color-review)]">hour_of_day</code>, <code className="text-[var(--color-review)]">day_of_week</code>) have
            incompatible scales between the two datasets. They must be provided twice with prefixes:
            <code className="text-[var(--accent-strong)] ml-1">pri_*</code> for the Primary model&apos;s scale and{" "}
            <code className="text-[var(--model-secondary-strong)]">sec_*</code> for the Secondary model&apos;s scale.
            Download the template CSV for correct column names and example values.
          </p>
        </div>
      </div>

      {/* ── Upload + config ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3">
          <EnsembleUpload onSubmit={handleSubmit} loading={loading} />
        </div>

        {/* Quick reference card */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 h-full">
            <p className="text-xs font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-1.5">
              <BookOpen size={13} className="text-[var(--text-secondary)]" /> Risk Classification
            </p>
            <div className="space-y-2.5">
              {[
                { label: "🔴  High Risk",     range: "Ensemble Score ≥ 0.70", color: "text-[var(--color-attack)]",     border: "border-red-500/20",     bg: "bg-red-500/5",     desc: "Immediate SOC attention"       },
                { label: "🟡  Moderate Risk", range: "0.40 ≤ Score < 0.70",  color: "text-[var(--color-review)]",   border: "border-amber-500/20",   bg: "bg-amber-500/5",   desc: "Review and monitor"             },
                { label: "🟢  Low Risk",      range: "Score < 0.40",          color: "text-[var(--color-normal)]", border: "border-emerald-500/20", bg: "bg-emerald-500/5", desc: "Likely normal, log for audit"   },
              ].map(({ label, range, color, border, bg, desc }) => (
                <div key={label} className={cn("rounded-lg border px-3 py-2", border, bg)}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-semibold", color)}>{label}</span>
                    <code className="text-[10px] text-[var(--text-secondary)] font-mono">{range}</code>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] space-y-1">
              <p>Primary internal threshold: 0.5025</p>
              <p>Secondary internal threshold: 0.4536</p>
              <p>Ensemble threshold: configurable (default 0.50)</p>
              <p className="text-[var(--color-review)] mt-1.5">Risk thresholds are demonstration defaults. No held-out ensemble validation data exists.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <Info size={15} className="text-[var(--color-attack)] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-attack)]">Ensemble Error</p>
            <p className="text-xs text-[var(--color-attack)] mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────── */}
      {result && <EnsembleResults result={result} />}

      {/* ── Schema reference ─────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <button
          onClick={() => setSchemaOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Complete 34-Column Schema Reference
            </span>
            <span className="text-[10px] text-[var(--text-muted)] ml-1">
              ({ENSEMBLE_COLUMNS.length} required columns)
            </span>
          </div>
          {schemaOpen
            ? <ChevronUp size={16} className="text-[var(--text-secondary)]" />
            : <ChevronDown size={16} className="text-[var(--text-secondary)]" />
          }
        </button>

        {schemaOpen && (
          <div className="border-t border-[var(--border)] overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Column Name</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Model</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                {ENSEMBLE_COLUMNS.map((col, i) => {
                  const model = COLUMN_MODEL[col];
                  return (
                    <tr key={col} className={cn("border-b border-[var(--border)]/50", i % 2 === 0 ? "bg-[var(--bg-card)]" : "bg-[var(--bg-card-alt-2)]")}>
                      <td className="px-4 py-2 text-[var(--text-muted)]">{i + 1}</td>
                      <td className="px-4 py-2">
                        <code className={cn(
                          "text-[11px] font-mono",
                          model === "primary"   ? "text-[var(--accent-strong)]"
                          : model === "secondary" ? "text-[var(--model-secondary-strong)]"
                          : "text-[var(--color-normal)]"
                        )}>{col}</code>
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase",
                          model === "primary"
                            ? "bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]"
                            : "bg-[var(--color-normal)]/10 border-[var(--color-normal)]/20 text-[var(--color-normal)]"
                        )}>
                          {model === "primary" ? "PRI" : "SEC"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">{COLUMN_DOCS[col]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
