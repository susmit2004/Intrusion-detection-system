import { cn } from "@/lib/utils";
import type { RiskLevel, PredictionLabel } from "@/types";
import { AlertTriangle, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";

interface RiskBadgeProps {
  level: RiskLevel;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const RISK_CONFIG: Record<
  RiskLevel,
  { bg: string; border: string; text: string; icon: React.ReactNode; label: string }
> = {
  "High Risk": {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: <ShieldAlert size={11} />,
    label: "High Risk",
  },
  "Moderate Risk": {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: <AlertTriangle size={11} />,
    label: "Moderate Risk",
  },
  "Low Risk": {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
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
        cfg.bg, cfg.border, cfg.text,
        SIZE_MAP[size],
        className
      )}
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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        SIZE_MAP[size],
        isAttack
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        className
      )}
    >
      {isAttack ? <AlertCircle size={11} /> : <CheckCircle size={11} />}
      {prediction}
    </span>
  );
}
