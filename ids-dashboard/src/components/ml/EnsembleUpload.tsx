"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";
import {
  Upload, CheckCircle, XCircle, AlertTriangle, Loader2,
  FileText, Settings, Info,
} from "lucide-react";
import { ENSEMBLE_COLUMNS } from "@/lib/ensembleData";
import Papa from "papaparse";

export interface EnsembleConfig {
  w_primary:   number;
  w_secondary: number;
  threshold:   number;
}

interface EnsembleUploadProps {
  onSubmit: (file: File, config: EnsembleConfig) => void;
  loading?: boolean;
}

export default function EnsembleUpload({ onSubmit, loading = false }: EnsembleUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileStatus, setFileStatus] = useState<{
    status: "idle" | "ok" | "error";
    message: string;
    rowCount?: number;
    missing?: string[];
  }>({ status: "idle", message: "" });

  const [config, setConfig] = useState<EnsembleConfig>({
    w_primary:   0.5,
    w_secondary: 0.5,
    threshold:   0.5,
  });
  const [wError, setWError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Weight slider: changing one adjusts the other to keep sum = 1
  const handleWPrimary = (v: number) => {
    const wp = Math.round(v * 100) / 100;
    const ws = Math.round((1 - wp) * 100) / 100;
    setConfig((c) => ({ ...c, w_primary: wp, w_secondary: ws }));
    setWError("");
  };

  const validateFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      setFileStatus({ status: "error", message: "Only CSV files are supported." });
      return;
    }
    Papa.parse(f, {
      header: true,
      preview: 2,
      complete: (result) => {
        const headers = new Set(result.meta.fields ?? []);
        const missing = ENSEMBLE_COLUMNS.filter((c) => !headers.has(c));
        const rowCount = Math.max(1, (f.size / 250) | 0);
        if (missing.length > 0) {
          setFileStatus({
            status: "error",
            message: `Missing ${missing.length} required column(s).`,
            missing,
          });
        } else {
          setFileStatus({ status: "ok", message: "All 34 columns found. Ready.", rowCount });
          setFile(f);
        }
      },
      error: () =>
        setFileStatus({ status: "error", message: "Failed to parse CSV." }),
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) validateFile(f);
    },
    [validateFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) validateFile(f);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!file || fileStatus.status !== "ok") return;
    if (Math.abs(config.w_primary + config.w_secondary - 1) > 0.01) {
      setWError("Weights must sum to 1.0");
      return;
    }
    onSubmit(file, config);
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer",
          "transition-all duration-200",
          dragOver              ? "border-violet-400 bg-violet-500/10"
          : fileStatus.status === "ok"    ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500/70"
          : fileStatus.status === "error" ? "border-red-500/40 bg-red-500/5"
          : "border-[#1e3a5f] bg-[#0a1628] hover:border-violet-500/40 hover:bg-violet-500/5",
          loading && "pointer-events-none opacity-60"
        )}
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} disabled={loading} />

        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 size={28} className="text-violet-400 animate-spin" />
          ) : fileStatus.status === "ok" ? (
            <CheckCircle size={28} className="text-emerald-400" />
          ) : fileStatus.status === "error" ? (
            <XCircle size={28} className="text-red-400" />
          ) : (
            <Upload size={28} className="text-slate-500" />
          )}

          {loading ? (
            <div>
              <p className="text-sm font-semibold text-violet-400">Running ensemble inference…</p>
              <p className="text-xs text-slate-500 mt-1">Both models processing in parallel</p>
            </div>
          ) : fileStatus.status === "idle" ? (
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Drop your ensemble CSV, or{" "}
                <span className="text-violet-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Requires all <span className="text-violet-400 font-semibold">34 columns</span> — download the template below
              </p>
            </div>
          ) : (
            <div>
              <p className={cn(
                "text-sm font-semibold",
                fileStatus.status === "ok" ? "text-emerald-400" : "text-red-400"
              )}>
                {fileStatus.message}
              </p>
              {file && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <FileText size={12} className="text-slate-500" />
                  <span className="text-[11px] text-slate-500">{file.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Missing columns detail */}
      {fileStatus.missing && fileStatus.missing.length > 0 && (
        <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-3">
          <p className="text-xs font-semibold text-red-400 mb-2">Missing columns:</p>
          <div className="flex flex-wrap gap-1">
            {fileStatus.missing.map((c) => (
              <code key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 font-mono">{c}</code>
            ))}
          </div>
        </div>
      )}

      {/* Config panel */}
      <div className="rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-violet-400" />
          <p className="text-sm font-semibold text-white">Ensemble Configuration</p>
        </div>

        {/* Weight slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Model Weights</span>
            <div className="flex gap-3 text-[11px] font-mono">
              <span className="text-blue-400">Primary: {config.w_primary.toFixed(2)}</span>
              <span className="text-slate-500">+</span>
              <span className="text-violet-400">Secondary: {config.w_secondary.toFixed(2)}</span>
              <span className="text-slate-500">= 1.00</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-blue-400 w-12 text-right font-mono">PRI</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={config.w_primary}
              onChange={(e) => handleWPrimary(parseFloat(e.target.value))}
              className="flex-1 accent-violet-500"
            />
            <span className="text-[10px] text-violet-400 w-12 font-mono">SEC</span>
          </div>
          {/* Visual weight bar */}
          <div className="flex h-2 rounded-full overflow-hidden mt-2 gap-0.5">
            <div className="bg-blue-500 rounded-l-full transition-all" style={{ width: `${config.w_primary * 100}%` }} />
            <div className="bg-violet-500 rounded-r-full transition-all" style={{ width: `${config.w_secondary * 100}%` }} />
          </div>
          {wError && <p className="text-[11px] text-red-400 mt-1">{wError}</p>}
        </div>

        {/* Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Classification Threshold</span>
            <span className="text-[11px] font-mono text-violet-400">{config.threshold.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.01} max={0.99} step={0.01}
            value={config.threshold}
            onChange={(e) => setConfig((c) => ({ ...c, threshold: parseFloat(e.target.value) }))}
            className="w-full accent-violet-500"
          />
          <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
            <span>More Sensitive</span>
            <span>score ≥ {config.threshold.toFixed(2)} → Attack</span>
            <span>More Specific</span>
          </div>
        </div>

        {/* Formula preview */}
        <div className="rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Ensemble Formula</p>
          <code className="text-[11px] text-slate-300 font-mono leading-relaxed">
            ensemble_score = {config.w_primary.toFixed(2)} × primary_hybrid_cal<br/>
            {"               + "}{config.w_secondary.toFixed(2)} × secondary_hybrid_cal<br/>
            Attack if ensemble_score ≥ {config.threshold.toFixed(2)}
          </code>
        </div>

        {/* Default weights note */}
        <div className="flex items-start gap-2">
          <Info size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-300/70 leading-relaxed">
            Default weights 0.5 / 0.5 are a conservative equal split.
            No held-out validation data exists for the combined 34-feature schema,
            so no other weighting is currently justified. Threshold default 0.5 is
            the midpoint of the [0, 1] calibrated probability scale.
          </p>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={fileStatus.status !== "ok" || loading}
        className={cn(
          "w-full py-3 rounded-xl font-semibold text-sm transition-all",
          fileStatus.status === "ok" && !loading
            ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 shadow-lg"
            : "bg-[#0f1f3d] text-slate-600 cursor-not-allowed border border-[#1e3a5f]"
        )}
      >
        {loading ? "Running Ensemble…" : "Run Ensemble Analysis"}
      </button>
    </div>
  );
}
