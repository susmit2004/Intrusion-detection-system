"""Read-only audit of supplied datasets and historical saved predictions.

Run from the repository root: python -X utf8 tools/audit_experiments.py
Writes audit artifacts only under artifacts/verified/audit/.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from research.shared.experiment_support import feature_groups, metric_record, sha256_file
sys.path.insert(0, str(ROOT / "experiments" / "primary"))
from src.config import FEATURE_COLS as PRIMARY_FEATURES

PRIMARY_ARTIFACTS = ROOT / "artifacts/primary"
SECONDARY = ROOT / "artifacts/secondary"
OUT = ROOT / "artifacts/verified/audit"
DATA_FILES = {
    "primary": [ROOT / "data/raw/primary" / name for name in
                ["Primary_training_data.xlsx", "Primary_testing_data.xlsx"]],
    "secondary": [ROOT / "data/raw/secondary" / name for name in
                  ["Secondary_Train_70.csv", "Secondary_Test_30.csv"]],
}


def source_audit(name, paths):
    frames = [pd.read_excel(p) if p.suffix == ".xlsx" else pd.read_csv(p) for p in paths]
    train, test = frames
    features = PRIMARY_FEATURES if name == "primary" else [c for c in train if c != "Label"]
    hashes = [pd.util.hash_pandas_object(f, index=False) for f in frames]
    groups = [feature_groups(f[features]) for f in frames]
    data = {
        "files": [{"path": p.relative_to(ROOT).as_posix(), "sha256": sha256_file(p),
                   "rows": len(f), "columns": len(f.columns),
                   "duplicate_rows": int(f.duplicated().sum()),
                   "missing_features": int(f[features].isna().sum().sum()),
                   "nonfinite_features": int((~np.isfinite(f[features].to_numpy(dtype=float))).sum()),
                   "labels": {str(k): int(v) for k, v in f[
                       "label_multiclass" if name == "primary" else "Label"
                   ].value_counts(dropna=False).items()}}
                  for p, f in zip(paths, frames)],
        "test_rows_identical_to_development": int(hashes[1].isin(hashes[0]).sum()),
        "test_rows_with_features_seen_in_development": int(np.isin(groups[1], groups[0]).sum()),
        "session_identifiers_available": any(c in train for c in ["flow_id", "Flow ID", "session_id"]),
        "features": features,
    }
    if "timestamp" in train:
        timestamps = [pd.to_datetime(f.timestamp, utc=True) for f in frames]
        data["timestamp_ranges"] = [{"min": str(t.min()), "max": str(t.max())} for t in timestamps]
        data["test_strictly_after_development"] = bool(timestamps[0].max() < timestamps[1].min())
    return data


def replay_saved_metrics(name):
    base = PRIMARY_ARTIFACTS if name == "primary" else SECONDARY
    prefix = "" if name == "primary" else "secondary_"
    predictions = pd.read_csv(base / "predictions" / f"{prefix}predictions_test.csv")
    summary = pd.read_csv(base / "metrics" / f"{prefix}evaluation_summary_test.csv")
    summary.columns = [c.lower() for c in summary.columns]
    probability_columns = (["lr_prob", "rf_prob", "hybrid_score_calibrated"] if name == "primary"
                           else ["lr_prob_calibrated", "rf_prob_calibrated", "hybrid_score_calibrated"])
    rows, checks = [], []
    for model, pred_col, prob_col in zip(
        ["Logistic Regression", "Random Forest", "Hybrid"],
        ["lr_pred", "rf_pred", "hybrid_pred"], probability_columns,
    ):
        record = metric_record(predictions.label_binary, predictions[pred_col],
                               predictions[prob_col], model, "historical_test")
        record["dataset"] = name
        rows.append(record)
        source = summary.loc[summary.model.isin([model, model + " Model"])].iloc[0]
        checks.append({"model": model, "metric_differences": {
            metric: float(record[metric] - source[metric])
            for metric in ["accuracy", "precision", "recall", "f1", "roc_auc"]
        }})
    pd.DataFrame(rows).to_csv(OUT / f"{name}_historical_metrics_recomputed.csv", index=False)
    # Legacy CSV probabilities were rounded; small AUC differences are possible.
    return {"checks": checks, "all_within_rounding_tolerance": all(
        abs(value) <= 0.00011 for check in checks for value in check["metric_differences"].values()
    )}


def baseline_manifest():
    candidates = set(p for paths in DATA_FILES.values() for p in paths)
    candidates.update(p for p in PRIMARY_ARTIFACTS.rglob("*") if p.is_file())
    candidates.update(p for p in SECONDARY.rglob("*")
                      if p.is_file() and p.suffix not in [".py", ".pyc"])
    comparison = ROOT / "artifacts/comparison"
    candidates.update(p for p in comparison.rglob("*") if p.is_file())
    return {p.relative_to(ROOT).as_posix(): sha256_file(p) for p in sorted(candidates)}


def normalize_legacy_manifest_paths(manifest):
    """Translate paths recorded before the role-based directory migration."""
    replacements = (
        ("Raw Data/Primary data/", "data/raw/primary/"),
        ("Raw Data/Secondary data/", "data/raw/secondary/"),
        ("ML Models/ML Models/Secondary Model/", "artifacts/secondary/"),
        ("ML Models/ML Models/comparison_plots/", "artifacts/comparison/plots/"),
        ("ML Models/ML Models/", "artifacts/comparison/"),
        ("results/", "artifacts/primary/"),
    )
    normalized = {}
    for path, digest in manifest.items():
        for old, new in replacements:
            if path.startswith(old):
                path = new + path[len(old):]
                break
        normalized[path] = digest
    return normalized


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "baseline_manifest.json"
    current = baseline_manifest()
    if manifest_path.exists():
        stored_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        original = normalize_legacy_manifest_paths(stored_manifest)
        if original != stored_manifest:
            # Preserve every recorded digest while updating only the moved paths.
            manifest_path.write_text(json.dumps(original, indent=2), encoding="utf-8")
        changed = [p for p, digest in original.items() if current.get(p) != digest]
        if changed:
            raise RuntimeError(f"Original datasets/artifacts changed: {changed}")
    else:
        manifest_path.write_text(json.dumps(current, indent=2), encoding="utf-8")
    result = {name: source_audit(name, paths) for name, paths in DATA_FILES.items()}
    result["historical_metric_replay"] = {name: replay_saved_metrics(name) for name in DATA_FILES}
    result["original_files_preserved"] = True
    (OUT / "data_and_artifact_audit.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({name: {k: v for k, v in result[name].items() if k not in ["files", "features"]}
                      for name in DATA_FILES}, indent=2))
    print("Historical metrics:", result["historical_metric_replay"])
    print(f"Original file hashes recorded/verified: {len(current)}")


if __name__ == "__main__":
    main()
