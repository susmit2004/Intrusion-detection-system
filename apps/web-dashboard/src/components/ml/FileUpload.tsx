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

  const borderStyle = (() => {
    if (dragOver) return { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)" };
    if (validation.status === "ok") return { borderColor: "color-mix(in srgb, var(--color-normal) 50%, transparent)", background: "color-mix(in srgb, var(--color-normal) 5%, transparent)" };
    if (validation.status === "error") return { borderColor: "color-mix(in srgb, var(--color-attack) 40%, transparent)", background: "color-mix(in srgb, var(--color-attack) 5%, transparent)" };
    return { borderColor: "var(--border)", background: "var(--bg-elevated)" };
  })();

  const statusIcon = {
    idle:  <Upload size={28} style={{ color: "var(--text-muted)" }} />,
    ok:    <CheckCircle size={28} style={{ color: "var(--color-normal)" }} />,
    warn:  <AlertTriangle size={28} style={{ color: "var(--color-review)" }} />,
    error: <XCircle size={28} style={{ color: "var(--color-attack)" }} />,
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
          loading && "pointer-events-none opacity-60"
        )}
        style={borderStyle}
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
          {loading
            ? <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
            : statusIcon
          }

          {loading ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Analysing…</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Running ML inference pipeline</p>
            </div>
          ) : validation.status === "idle" ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Drop your CSV here, or{" "}
                <span style={{ color: "var(--accent)" }} className="underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Requires {model === "primary" ? "22" : "12"} network-flow feature columns
              </p>
            </div>
          ) : (
            <div>
              <p
                className="text-sm font-semibold"
                style={{
                  color: validation.status === "ok" ? "var(--color-normal)"
                    : validation.status === "warn" ? "var(--color-review)"
                    : "var(--color-attack)",
                }}
              >
                {validation.message}
              </p>
              {validation.fileName && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <FileText size={12} style={{ color: "var(--text-muted)" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {validation.fileName}
                  </span>
                  {validation.rowCount && (
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      (~{validation.rowCount.toLocaleString()} rows, estimated)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && (
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              .csv files only
            </p>
          )}
        </div>
      </div>

      {/* Warnings */}
      {validation.warnings?.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-2 rounded-lg border"
          style={{
            background: "color-mix(in srgb, var(--color-review) 5%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-review) 20%, transparent)",
          }}
        >
          <AlertTriangle size={12} style={{ color: "var(--color-review)" }} className="mt-0.5 shrink-0" />
          <p className="text-[11px]" style={{ color: "var(--color-review)" }}>{w}</p>
        </div>
      ))}
    </div>
  );
}
