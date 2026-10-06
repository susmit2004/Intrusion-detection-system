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
    <div className={cn("rounded-xl border border-[#1e3a5f] bg-[#0a1628] p-5", className)}>
      {modelName && (
        <p className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">
          {modelName} — Confusion Matrix
        </p>
      )}

      {/* Labels */}
      <div className="flex gap-2 mb-2 ml-20">
        <div className="flex-1 text-center text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
          Predicted Normal
        </div>
        <div className="flex-1 text-center text-[11px] font-semibold text-red-400 uppercase tracking-wider">
          Predicted Attack
        </div>
      </div>

      <div className="space-y-2">
        {/* Row 1: True Normal */}
        <div className="flex items-stretch gap-2">
          <div className="w-20 flex items-center justify-end pr-2">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider text-right">
              True Normal
            </span>
          </div>
          {/* TN */}
          <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">
              {tn.toLocaleString()}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              TN · {pct(tn)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">True Negative</p>
          </div>
          {/* FP */}
          <div className="flex-1 rounded-lg bg-red-500/5 border border-red-500/10 p-3 text-center">
            <p className="text-lg font-bold text-red-400/60 tabular-nums">
              {fp.toLocaleString()}
            </p>
            <p className="text-[10px] text-red-700 font-medium mt-0.5">
              FP · {pct(fp)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">False Alarm</p>
          </div>
        </div>

        {/* Row 2: True Attack */}
        <div className="flex items-stretch gap-2">
          <div className="w-20 flex items-center justify-end pr-2">
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider text-right">
              True Attack
            </span>
          </div>
          {/* FN */}
          <div className="flex-1 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 text-center">
            <p className="text-lg font-bold text-amber-400/60 tabular-nums">
              {fn.toLocaleString()}
            </p>
            <p className="text-[10px] text-amber-700 font-medium mt-0.5">
              FN · {pct(fn)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Missed Attack</p>
          </div>
          {/* TP */}
          <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">
              {tp.toLocaleString()}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              TP · {pct(tp)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">True Positive</p>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mt-4 pt-3 border-t border-[#1e3a5f] flex items-center justify-between text-[11px]">
        <span className="text-slate-500">
          Total:{" "}
          <span className="text-white font-semibold">{total.toLocaleString()}</span>
        </span>
        <span className="text-slate-500">
          Accuracy:{" "}
          <span className="text-emerald-400 font-semibold">{accuracy}%</span>
        </span>
        <span className="text-slate-500">
          Missed:{" "}
          <span className="text-red-400 font-semibold">{fn.toLocaleString()}</span>
        </span>
      </div>
    </div>
  );
}
