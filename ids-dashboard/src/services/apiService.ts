// ============================================================
// API Service Layer
// ─────────────────────────────────────────────────────────────
// All backend communication lives here.
// • When NEXT_PUBLIC_API_URL is set, real HTTP calls are made.
// • When it is not set (or the call fails), mock data is returned
//   so the UI stays fully functional during development / viva.
// ─────────────────────────────────────────────────────────────
// Backend endpoints expected (FastAPI / Flask):
//   POST /api/primary/predict  — multipart CSV upload
//   POST /api/secondary/predict
//   GET  /api/primary/config
//   GET  /api/secondary/config
//   GET  /api/comparison
// ============================================================

import type {
  InferenceResponse,
  ModelConfig,
  ModelName,
} from "@/types";
import {
  PRIMARY_MODEL_CONFIG,
  SECONDARY_MODEL_CONFIG,
  MOCK_PREDICTION_ROWS,
  MOCK_PREDICTION_SUMMARY,
} from "@/lib/mockData";
import { API_BASE_URL } from "@/lib/constants";

const USE_MOCK = !process.env.NEXT_PUBLIC_API_URL;

// ── helpers ──────────────────────────────────────────────────────────────────
async function post<T>(path: string, body: FormData | string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body,
    ...(typeof body === "string"
      ? { headers: { "Content-Type": "application/json" } }
      : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Mock builders ──────────────────────────────────────────────────────────
function buildMockResponse(
  model: ModelName,
  rowCount: number
): InferenceResponse {
  // Scale mock rows to uploaded row count
  const scale = Math.ceil(rowCount / MOCK_PREDICTION_ROWS.length);
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    ...MOCK_PREDICTION_ROWS[i % MOCK_PREDICTION_ROWS.length],
    id: i + 1,
  }));

  const attacks = rows.filter((r) => r.prediction === "Attack").length;
  const normal  = rowCount - attacks;

  return {
    model,
    summary: {
      total_events:   rowCount,
      normal_count:   normal,
      attack_count:   attacks,
      high_risk:      rows.filter((r) => r.risk_level === "High Risk").length,
      moderate_risk:  rows.filter((r) => r.risk_level === "Moderate Risk").length,
      low_risk:       rows.filter((r) => r.risk_level === "Low Risk").length,
      attack_rate:    Math.round((attacks / rowCount) * 1000) / 10,
      detection_rate: 99.66,
    },
    rows,
    processing_time_ms: Math.round(50 + Math.random() * 200),
    errors: [],
  };
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function predictCSV(
  file: File,
  model: ModelName
): Promise<InferenceResponse> {
  if (USE_MOCK) {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    // Count rows by reading file (minus header)
    const text = await file.text();
    const rowCount = Math.max(1, text.split("\n").length - 2);
    return buildMockResponse(model, rowCount);
  }

  const form = new FormData();
  form.append("file", file);
  return post<InferenceResponse>(`/api/${model}/predict`, form);
}

export async function getModelConfig(
  model: ModelName
): Promise<ModelConfig> {
  if (USE_MOCK) {
    return model === "primary" ? PRIMARY_MODEL_CONFIG : SECONDARY_MODEL_CONFIG;
  }
  return get<ModelConfig>(`/api/${model}/config`);
}

export async function getOverviewStats(): Promise<{
  primary: typeof MOCK_PREDICTION_SUMMARY;
  secondary: typeof MOCK_PREDICTION_SUMMARY;
}> {
  if (USE_MOCK) {
    return {
      primary: {
        ...MOCK_PREDICTION_SUMMARY,
        total_events: 3607,
        normal_count: 618,
        attack_count: 2989,
        high_risk: 1139,
        moderate_risk: 766,
        low_risk: 1702,
        attack_rate: 82.9,
        detection_rate: 97.79,
      },
      secondary: {
        ...MOCK_PREDICTION_SUMMARY,
        total_events: 30000,
        normal_count: 24078,
        attack_count: 5922,
        high_risk: 5279,
        moderate_risk: 571,
        low_risk: 24150,
        attack_rate: 19.74,
        detection_rate: 99.66,
      },
    };
  }
  return get("/api/overview");
}

// ── API availability check ─────────────────────────────────────────────────
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const isMockMode = USE_MOCK;
