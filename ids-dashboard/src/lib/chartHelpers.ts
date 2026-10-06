// Recharts 3.x changed Tooltip formatter to ValueType which includes undefined.
// This helper wraps formatters so they typecheck without casting in every file.
export const fmtNumber = (v: unknown) =>
  typeof v === "number" ? v.toLocaleString() : String(v ?? "");

export const fmtPct = (v: unknown) =>
  typeof v === "number" ? v.toFixed(2) + "%" : String(v ?? "");
