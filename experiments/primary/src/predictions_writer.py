"""
predictions_writer.py
=====================
Saves per-record model predictions to a CSV file.

Each row in the output corresponds to one network flow event in the
test set, with:
  - Original event reference (row_index, timestamp, multiclass label)
  - Logistic Regression probability (raw) and hard prediction
  - Random Forest probability (raw) and hard prediction
  - Hybrid score (calibrated weighted combination)
  - Final hybrid hard prediction (tuned threshold)
  - SOC Triage Level (Low Suspicion / Review / High Suspicion)

The file is self-contained and readable by the dashboard without
any model artefacts.
"""

import pandas as pd
import numpy as np
import os

from src.config import PREDICTIONS_DIR
from src.hybrid import apply_triage


def save_predictions(
    meta:         pd.DataFrame,
    lr_prob_raw:  np.ndarray,
    lr_pred:      np.ndarray,
    rf_prob_raw:  np.ndarray,
    rf_pred:      np.ndarray,
    hybrid_score_raw: np.ndarray,
    hybrid_score_cal: np.ndarray,
    hybrid_pred:  np.ndarray,
    low_thr:      float,
    high_thr:     float,
    split_name:   str = "test",
) -> str:
    """
    Assemble and save a predictions CSV.

    Parameters
    ----------
    meta          : DataFrame with timestamp, label_multiclass, label_binary,
                    row_index (from data_loader)
    *_prob, *_pred: numpy arrays aligned row-by-row with meta
    hybrid_score_raw : uncalibrated weighted combination
    hybrid_score_cal : calibrated weighted combination
    hybrid_pred   : final binary prediction using tuned threshold
    low_thr, high_thr : triage band boundaries
    split_name    : 'val' or 'test'

    Returns the path to the saved file.
    """
    os.makedirs(PREDICTIONS_DIR, exist_ok=True)

    triage = apply_triage(hybrid_score_cal, low_thr, high_thr)

    out = pd.DataFrame({
        "row_index":           meta["row_index"].values
                               if "row_index" in meta.columns
                               else np.arange(len(meta)),
        "timestamp":           meta["timestamp"].dt.tz_convert("Asia/Kolkata")
                               .dt.strftime("%Y-%m-%d %H:%M:%S %Z")
                               if hasattr(meta["timestamp"], "dt") else meta["timestamp"],
        "label_multiclass":    meta["label_multiclass"].values,
        "label_binary":        meta["label_binary"].values,
        "lr_prob":             np.round(lr_prob_raw, 6),
        "lr_pred":             lr_pred.astype(int),
        "rf_prob":             np.round(rf_prob_raw, 6),
        "rf_pred":             rf_pred.astype(int),
        "hybrid_score_raw":    np.round(hybrid_score_raw, 6),
        "hybrid_score_calibrated": np.round(hybrid_score_cal, 6),
        "hybrid_pred":         hybrid_pred.astype(int),
        "triage_level":        triage,
    })

    path = os.path.join(PREDICTIONS_DIR, f"predictions_{split_name}.csv")
    out.to_csv(path, index=False)
    print(f"  Predictions saved: {path}  ({len(out)} rows)")

    # Quick summary
    triage_counts = out["triage_level"].value_counts()
    print("  Triage level distribution:")
    for level in ["Low Suspicion", "Review", "High Suspicion"]:
        cnt = triage_counts.get(level, 0)
        print(f"    {level:<20s}: {cnt}")

    return path
