"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Upload, CheckCircle, XCircle, Loader2,
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
          dragOver              ? "border-[var(--accent)]"
          : fileStatus.status === "ok"    ? "hover:opacity-90"
          : "",
          loading && "pointer-events-none opacity-60"
        )}
        style={
          dragOver
            ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }
            : fileStatus.status === "ok"
            ? { borderColor: "color-mix(in srgb, var(--color-normal) 50%, transparent)", background: "color-mix(in srgb, var(--color-normal) 5%, transparent)" }
            : fileStatus.status === "error"
            ? { borderColor: "color-mix(in srgb, var(--color-attack) 40%, transparent)", background: "color-mix(in srgb, var(--color-attack) 5%, transparent)" }
            : { borderColor: "var(--border)", background: "var(--bg-elevated)" }
        }
      >
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} disabled={loading} />

        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
          ) : fileStatus.status === "ok" ? (
            <CheckCircle size={28} style={{ color: "var(--color-normal)" }} />
          ) : fileStatus.status === "error" ? (
            <XCircle size={28} style={{ color: "var(--color-attack)" }} />
          ) : (
            <Upload size={28} style={{ color: "var(--text-muted)" }} />
          )}

          {loading ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Running ensemble inference…</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Both models processing in parallel</p>
            </div>
          ) : fileStatus.status === "idle" ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Drop your ensemble CSV, or{" "}
                <span style={{ color: "var(--accent)" }} className="underline">browse</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Requires all <span style={{ color: "var(--accent)" }} className="font-semibold">34 columns</span> — download the template below
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold" style={{ color: fileStatus.status === "ok" ? "var(--color-normal)" : "var(--color-attack)" }}>
                {fileStatus.message}
              </p>
              {file && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <FileText size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{file.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Missing columns detail */}
      {fileStatus.missing && fileStatus.missing.length > 0 && (
        <div className="rounded-lg border p-3" style={{ background: "color-mix(in srgb, var(--color-attack) 5%, transparent)", borderColor: "color-mix(in srgb, var(--color-attack) 20%, transparent)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-attack)" }}>Missing columns:</p>
          <div className="flex flex-wrap gap-1">
            {fileStatus.missing.map((c) => (
              <code key={c} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "color-mix(in srgb, var(--color-attack) 10%, transparent)", color: "var(--color-attack)" }}>{c}</code>
            ))}
          </div>
        </div>
      )}

      {/* Config panel */}
      <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2">
          <Settings size={14} style={{ color: "var(--accent)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Ensemble Configuration</p>
        </div>

        {/* Weight slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Model Weights</span>
            <div className="flex gap-3 text-[11px] font-mono">
              <span style={{ color: "var(--accent)" }}>Primary: {config.w_primary.toFixed(2)}</span>
              <span style={{ color: "var(--text-muted)" }}>+</span>
              <span style={{ color: "var(--color-normal)" }}>Secondary: {config.w_secondary.toFixed(2)}</span>
              <span style={{ color: "var(--text-muted)" }}>= 1.00</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] w-12 text-right font-mono" style={{ color: "var(--accent)" }}>PRI</span>
            <input
              type="range" min={0} max={1} step={0.05}
              value={config.w_primary}
              onChange={(e) => handleWPrimary(parseFloat(e.target.value))}
              className="flex-1"
              style={{ accentColor: "var(--accent)" }}
            />
            <span className="text-[10px] w-12 font-mono" style={{ color: "var(--color-normal)" }}>SEC</span>
          </div>
          {/* Visual weight bar */}
          <div className="flex h-2 rounded-full overflow-hidden mt-2 gap-0.5">
            <div className="rounded-l-full transition-all" style={{ width: `${config.w_primary * 100}%`, background: "var(--accent)" }} />
            <div className="rounded-r-full transition-all" style={{ width: `${config.w_secondary * 100}%`, background: "var(--color-normal)" }} />
          </div>
          {wError && <p className="text-[11px] mt-1" style={{ color: "var(--color-attack)" }}>{wError}</p>}
        </div>

        {/* Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Classification Threshold</span>
            <span className="text-[11px] font-mono" style={{ color: "var(--accent)" }}>{config.threshold.toFixed(2)}</span>
          </div>
          <input
            type="range" min={0.01} max={0.99} step={0.01}
            value={config.threshold}
            onChange={(e) => setConfig((c) => ({ ...c, threshold: parseFloat(e.target.value) }))}
            className="w-full"
            style={{ accentColor: "var(--accent)" }}
          />
          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            <span>More Sensitive</span>
            <span>score ≥ {config.threshold.toFixed(2)} → Attack</span>
            <span>More Specific</span>
          </div>
        </div>

        {/* Formula preview */}
        <div className="rounded-lg border p-3" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
          <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>Ensemble Formula</p>
          <code className="text-[11px] font-mono leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            ensemble_score = {config.w_primary.toFixed(2)} × primary_hybrid_cal<br/>
            {"               + "}{config.w_secondary.toFixed(2)} × secondary_hybrid_cal<br/>
            Attack if ensemble_score ≥ {config.threshold.toFixed(2)}
          </code>
        </div>

        {/* Default weights note */}
        <div className="flex items-start gap-2">
          <Info size={12} style={{ color: "var(--color-review)" }} className="mt-0.5 shrink-0" />
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-review)", opacity: 0.8 }}>
            Default weights 0.5 / 0.5 are a conservative equal split.
            No held-out validation data exists for the combined 34-feature schema,
            so no other weighting is currently justified. Threshold default 0.5 is
            a configurable midpoint for the combined model score.
          </p>
        </div>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={fileStatus.status !== "ok" || loading}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
        style={
          fileStatus.status === "ok" && !loading
            ? { background: "var(--accent)", color: "var(--bg-base)" }
            : { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "not-allowed" }
        }
      >
        {loading ? "Running Ensemble…" : "Run Ensemble Analysis"}
      </button>
    </div>
  );
}
