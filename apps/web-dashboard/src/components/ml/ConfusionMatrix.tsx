import { cn } from "@/lib/utils";

interface ConfusionMatrixProps {
  tp: number;
  tn: number;
  fp: number;
  fn: number;
  modelName?: string;
  className?: string;
}

export default function ConfusionMatrix({
  tp, tn, fp, fn,
  modelName,
  className,
}: ConfusionMatrixProps) {
  const total = tp + tn + fp + fn;
  const pct = (n: number) => ((n / total) * 100).toFixed(1) + "%";
  const accuracy = ((tp + tn) / total * 100).toFixed(2);

  return (
    <div
      className={cn("rounded-xl border p-5", className)}
      style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
    >
      {modelName && (
        <p
          className="text-xs font-bold mb-4 uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          {modelName}
        </p>
      )}

      {/* Column labels */}
      <div className="flex gap-2 mb-2 ml-20">
        <div
          className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-normal)" }}
        >
          Pred. Normal
        </div>
        <div
          className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-attack)" }}
        >
          Pred. Attack
        </div>
      </div>

      <div className="space-y-2">
        {/* Row 1: True Normal */}
        <div className="flex items-stretch gap-2">
          <div className="w-20 flex items-center justify-end pr-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-right"
              style={{ color: "var(--color-normal)" }}
            >
              True Normal
            </span>
          </div>
          {/* TN */}
          <div
            className="flex-1 rounded-lg p-3 text-center border"
            style={{
              background: "color-mix(in srgb, var(--color-normal) 8%, var(--bg-elevated))",
              borderColor: "color-mix(in srgb, var(--color-normal) 25%, transparent)",
            }}
          >
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--color-normal)" }}>
              {tn.toLocaleString()}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--color-normal)" }}>
              TN · {pct(tn)}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              True Negative
            </p>
          </div>
          {/* FP */}
          <div
            className="flex-1 rounded-lg p-3 text-center border"
            style={{
              background: "color-mix(in srgb, var(--color-attack) 5%, var(--bg-elevated))",
              borderColor: "color-mix(in srgb, var(--color-attack) 15%, transparent)",
            }}
          >
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--color-attack)", opacity: 0.7 }}>
              {fp.toLocaleString()}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--color-attack)", opacity: 0.7 }}>
              FP · {pct(fp)}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              False Alarm
            </p>
          </div>
        </div>

        {/* Row 2: True Attack */}
        <div className="flex items-stretch gap-2">
          <div className="w-20 flex items-center justify-end pr-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-right"
              style={{ color: "var(--color-attack)" }}
            >
              True Attack
            </span>
          </div>
          {/* FN */}
          <div
            className="flex-1 rounded-lg p-3 text-center border"
            style={{
              background: "color-mix(in srgb, var(--color-review) 5%, var(--bg-elevated))",
              borderColor: "color-mix(in srgb, var(--color-review) 15%, transparent)",
            }}
          >
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--color-review)", opacity: 0.8 }}>
              {fn.toLocaleString()}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--color-review)", opacity: 0.8 }}>
              FN · {pct(fn)}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Missed Attack
            </p>
          </div>
          {/* TP */}
          <div
            className="flex-1 rounded-lg p-3 text-center border"
            style={{
              background: "color-mix(in srgb, var(--color-normal) 8%, var(--bg-elevated))",
              borderColor: "color-mix(in srgb, var(--color-normal) 25%, transparent)",
            }}
          >
            <p className="text-lg font-bold tabular-nums" style={{ color: "var(--color-normal)" }}>
              {tp.toLocaleString()}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: "var(--color-normal)" }}>
              TP · {pct(tp)}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              True Positive
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div
        className="mt-4 pt-3 border-t flex items-center justify-between text-[11px]"
        style={{ borderColor: "var(--border)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>
          Total:{" "}
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {total.toLocaleString()}
          </span>
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          Accuracy:{" "}
          <span className="font-semibold" style={{ color: "var(--color-normal)" }}>
            {accuracy}%
          </span>
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          Missed:{" "}
          <span className="font-semibold" style={{ color: "var(--color-attack)" }}>
            {fn.toLocaleString()}
          </span>
        </span>
      </div>
    </div>
  );
}
