import { cn } from "@/lib/utils";
import type { RiskLevel, PredictionLabel } from "@/types";
import { AlertTriangle, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

type RiskConfig = {
  colorVar: string;
  icon: React.ReactNode;
  label: string;
};

const RISK_CONFIG: Record<RiskLevel, RiskConfig> = {
  "High Risk": {
    colorVar: "var(--color-attack)",
    icon: <ShieldAlert size={11} />,
    label: "High Risk",
  },
  "Moderate Risk": {
    colorVar: "var(--color-review)",
    icon: <AlertTriangle size={11} />,
    label: "Moderate Risk",
  },
  "Low Risk": {
    colorVar: "var(--color-normal)",
    icon: <CheckCircle size={11} />,
    label: "Low Risk",
  },
};

const SIZE_MAP = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

export function RiskBadge({
  level,
  showIcon = true,
  size = "md",
  className,
}: RiskBadgeProps) {
  const cfg = RISK_CONFIG[level];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        SIZE_MAP[size],
        className
      )}
      style={{
        background: `color-mix(in srgb, ${cfg.colorVar} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cfg.colorVar} 30%, transparent)`,
        color: cfg.colorVar,
      }}
    >
      {showIcon && cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Prediction badge (Normal / Attack) ────────────────────────────────────
interface PredictionBadgeProps {
  prediction: PredictionLabel;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PredictionBadge({
  prediction,
  size = "md",
  className,
}: PredictionBadgeProps) {
  const isAttack = prediction === "Attack";
  const colorVar = isAttack ? "var(--color-attack)" : "var(--color-normal)";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        SIZE_MAP[size],
        className
      )}
      style={{
        background: `color-mix(in srgb, ${colorVar} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${colorVar} 30%, transparent)`,
        color: colorVar,
      }}
    >
      {isAttack ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
      {prediction}
    </span>
  );
}
