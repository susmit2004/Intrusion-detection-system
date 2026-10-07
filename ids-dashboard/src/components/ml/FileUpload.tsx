"use client";

import { useState, useCallback, useRef } from "react";
import { cn, validateCSVColumns } from "@/lib/utils";
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { ModelName } from "@/types";
import Papa from "papaparse";

interface FileUploadProps {
  model: ModelName;
  onFile: (file: File, rowCount: number) => void;
  loading?: boolean;
  className?: string;
}

export default function FileUpload({
  model,
  onFile,
  loading = false,
  className,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [validation, setValidation] = useState<{
    status: "idle" | "ok" | "error" | "warn";
    message: string;
    warnings?: string[];
    rowCount?: number;
    fileName?: string;
  }>({ status: "idle", message: "" });

  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setValidation({ status: "error", message: "Only CSV files are supported." });
        return;
      }
      Papa.parse(file, {
        header: true,
        preview: 3,
        complete: (result) => {
          const headers = result.meta.fields ?? [];
          const v = validateCSVColumns(headers, model);
          const rawRows = file.size > 0 ? Math.max(1, (file.size / 200) | 0) : 1;

          if (!v.valid) {
            setValidation({
              status: "error",
              message: `Missing required columns: ${v.missing.join(", ")}`,
              fileName: file.name,
            });
            return;
          }
          setValidation({
            status: v.warnings.length ? "warn" : "ok",
            message: v.warnings.length
              ? "File accepted with warnings."
              : `${file.name} is valid. Ready to analyse.`,
            warnings: v.warnings,
            rowCount: rawRows,
            fileName: file.name,
          });
          onFile(file, rawRows);
        },
        error: () => {
          setValidation({ status: "error", message: "Failed to parse CSV file." });
        },
      });
    },
    [model, onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const statusIcon = {
    idle:  <Upload size={28} className="text-slate-500" />,
    ok:    <CheckCircle size={28} className="text-emerald-400" />,
    warn:  <AlertTriangle size={28} className="text-amber-400" />,
    error: <XCircle size={28} className="text-red-400" />,
  }[validation.status];

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 text-center",
          "transition-all duration-200 cursor-pointer",
          dragOver
            ? "border-blue-400 bg-blue-500/10"
            : validation.status === "ok"
            ? "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/60"
            : "hover:bg-blue-500/5",
          loading && "pointer-events-none opacity-60"
        )}
        style={
          !dragOver && validation.status !== "ok"
            ? validation.status === "error"
              ? {
                  borderColor: "color-mix(in srgb, var(--color-attack) 40%, transparent)",
                  background: "color-mix(in srgb, var(--color-attack) 5%, transparent)",
                }
              : { borderColor: "var(--border-color)", background: "var(--bg-card)" }
            : undefined
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleChange}
          disabled={loading}
        />

        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
          ) : (
            statusIcon
          )}

          {loading ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Analysing…</p>
              <p className="text-xs text-slate-500 mt-1">Running ML inference pipeline</p>
            </div>
          ) : validation.status === "idle" ? (
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Drop your CSV here, or{" "}
                <span className="text-blue-400 underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Requires {model === "primary" ? "22" : "12"} network-flow feature columns
              </p>
            </div>
          ) : (
            <div>
              <p
                className={cn(
                  "text-sm font-semibold",
                  validation.status === "ok"    && "text-emerald-400",
                  validation.status === "warn"  && "text-amber-400",
                  validation.status === "error" && "text-red-400"
                )}
              >
                {validation.message}
              </p>
              {validation.fileName && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <FileText size={12} className="text-slate-500" />
                  <span className="text-[11px] text-slate-500">{validation.fileName}</span>
                  {validation.rowCount && (
                    <span className="text-[11px] text-slate-600">
                      (~{validation.rowCount.toLocaleString()} rows)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && (
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">
              .csv files only
            </p>
          )}
        </div>
      </div>

      {/* Warnings */}
      {validation.warnings?.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20"
        >
          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-300">{w}</p>
        </div>
      ))}
    </div>
  );
}
