import { type ClassValue, clsx } from "clsx";
import type { RiskLevel, PredictionLabel } from "@/types";
import {
  SECONDARY_CONFIG,
  PRIMARY_CONFIG,
  SECONDARY_FEATURE_COLS,
  PRIMARY_FEATURE_COLS,
  FORBIDDEN_INPUT_COLS,
} from "./constants";

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// ── Risk classification ─────────────────────────────────────────────────────
export function getRiskLevel(
  hybridScore: number,
  model: "primary" | "secondary" = "secondary"
): RiskLevel {
  const cfg = model === "primary" ? PRIMARY_CONFIG : SECONDARY_CONFIG;
  if (hybridScore >= cfg.risk_high_threshold) return "High Risk";
  if (hybridScore >= cfg.risk_moderate_threshold) return "Moderate Risk";
  return "Low Risk";
}

export function getPredictionLabel(
  hybridScore: number,
  model: "primary" | "secondary" = "secondary"
): PredictionLabel {
  const cfg = model === "primary" ? PRIMARY_CONFIG : SECONDARY_CONFIG;
  return hybridScore >= cfg.decision_threshold ? "Attack" : "Normal";
}

// ── Formatting ──────────────────────────────────────────────────────────────
export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatScore(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}

export function formatMetric(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

// ── CSV validation ──────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  missing: string[];
  forbidden: string[];
  rowCount: number;
  columnCount: number;
  warnings: string[];
}

export function validateCSVColumns(
  headers: string[],
  model: "primary" | "secondary"
): ValidationResult {
  const required =
    model === "primary"
      ? (PRIMARY_FEATURE_COLS as unknown as string[])
      : (SECONDARY_FEATURE_COLS as unknown as string[]);

  const headerSet = new Set(headers);
  const missing = required.filter((c) => !headerSet.has(c));
  const forbidden = headers.filter((h) => FORBIDDEN_INPUT_COLS.has(h));
  const warnings: string[] = [];

  if (forbidden.length > 0) {
    warnings.push(
      `Columns [${forbidden.join(", ")}] will be ignored (not fed to the model — prevents data leakage).`
    );
  }

  return {
    valid: missing.length === 0,
    missing,
    forbidden,
    rowCount: 0,
    columnCount: headers.length,
    warnings,
  };
}

// ── Confusion matrix helpers ─────────────────────────────────────────────────
export function calcFPR(fp: number, tn: number): number {
  return fp + tn === 0 ? 0 : fp / (fp + tn);
}

export function calcFNR(fn: number, tp: number): number {
  return fn + tp === 0 ? 0 : fn / (fn + tp);
}

// ── Chart colors ─────────────────────────────────────────────────────────────
export const CHART_COLORS = {
  attack: "#F87171",
  normal: "#34D399",
  high: "#F87171",
  moderate: "#FBBF24",
  low: "#34D399",
  lr: "#38BDF8",
  rf: "#FB923C",
  hybrid: "#A78BFA",
  primary: "#60A5FA",
  secondary: "#A78BFA",
  grid: "#1A3352",
  text: "#8FA3B8",
  gridLight: "#0F2037",
  accent: "#22D3EE",
  muted: "#3D5475",
} as const;

// ── CSV download ─────────────────────────────────────────────────────────────
export function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Truncate long strings ────────────────────────────────────────────────────
export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}
