"""
train_and_evaluate.py
=====================
Main orchestration script for the Confidence-Based Hybrid ML Framework.

Run this first (before the dashboard):
    python experiments/primary/train_and_evaluate.py

Pipeline steps
--------------
1.  Load and inspect the prepared primary dataset
2.  Time-based train / validation / test split
3.  Train Logistic Regression (with StandardScaler pipeline)
4.  Train Random Forest Classifier (no scaling)
5.  Probability calibration (isotonic regression on validation set)
6.  Optimise hybrid weights on validation set
7.  Select decision threshold on validation set
8.  Determine SOC triage bands from validation distribution
9.  Evaluate LR, RF, Hybrid on validation set (diagnostic)
10. Evaluate LR, RF, Hybrid on TEST set (final, held-out)
11. Analyse feature importance and traffic patterns
12. Save predictions CSV (test set)
13. Save all model artefacts

Reproducibility metadata is written to:
    artifacts/primary/metrics/experiment_metadata.json
"""

import json
import os
import time
import numpy as np
import pandas as pd

from src.config import (
    RANDOM_SEED, DATASET_VERSION, DATASET_NOTE,
    FEATURE_COLS, TARGET_BINARY, VAL_FRAC,
    LR_PARAMS, RF_PARAMS, CALIBRATION_METHOD,
    METRICS_DIR, MODEL_DIR,
)
from src.data_loader         import load_and_split
from src.models              import train_models, get_probabilities, save_models
from src.hybrid              import tune_hybrid, compute_hybrid_score, apply_triage
from src.evaluation          import evaluate_all
from src.feature_analysis    import analyse_feature_importance, analyse_traffic_patterns
from src.predictions_writer  import save_predictions

np.random.seed(RANDOM_SEED)


def main():
    run_start = time.time()
    print("\n" + "#"*70)
    print("  Confidence-Based Hybrid ML Framework for SOC Alert Triage")
    print("#"*70)

    # ------------------------------------------------------------------
    # Step 1 & 2: Load data and split
    # ------------------------------------------------------------------
    data = load_and_split()

    X_train    = data["X_train"]
    y_train    = data["y_train"]
    meta_train = data["meta_train"]

    X_val      = data["X_val"]
    y_val      = data["y_val"]
    meta_val   = data["meta_val"]

    X_test     = data["X_test"]
    y_test     = data["y_test"]
    meta_test  = data["meta_test"]

    feature_names = data["feature_names"]

    # ------------------------------------------------------------------
    # Step 3 & 4 & 5: Train models + calibrate on validation set
    # ------------------------------------------------------------------
    models = train_models(X_train, y_train, X_val, y_val)

    # ------------------------------------------------------------------
    # Step 6, 7, 8: Hybrid tuning on validation set
    # ------------------------------------------------------------------
    print("\n\nGenerating VALIDATION set predictions for hybrid tuning ...")
    val_probs = get_probabilities(models, X_val, split_name="Validation")

    # Tune using CALIBRATED probabilities (more reliable soft scores)
    hybrid_cfg = tune_hybrid(
        lr_prob_val = val_probs["lr_prob_calibrated"],
        rf_prob_val = val_probs["rf_prob_calibrated"],
        y_val       = y_val,
        criterion   = "f1",       # change to 'recall' for max attack recall
    )

    w1            = hybrid_cfg["w1_lr"]
    w2            = hybrid_cfg["w2_rf"]
    dec_thr       = hybrid_cfg["decision_threshold"]
    low_thr       = hybrid_cfg["low_triage_threshold"]
    high_thr      = hybrid_cfg["high_triage_threshold"]

    # Compute hybrid scores for validation
    hybrid_val_raw = compute_hybrid_score(
        val_probs["lr_prob_raw"], val_probs["rf_prob_raw"], w1, w2
    )
    hybrid_val_cal = compute_hybrid_score(
        val_probs["lr_prob_calibrated"], val_probs["rf_prob_calibrated"], w1, w2
    )
    hybrid_val_pred = (hybrid_val_cal >= dec_thr).astype(int)

    # ------------------------------------------------------------------
    # Step 9: Evaluate on VALIDATION set (diagnostic)
    # ------------------------------------------------------------------
    print("\n\nValidation set evaluation ...")
    val_summary = evaluate_all(
        y_true       = y_val,
        lr_pred      = val_probs["lr_pred"],
        lr_prob      = val_probs["lr_prob_raw"],
        rf_pred      = val_probs["rf_pred"],
        rf_prob      = val_probs["rf_prob_raw"],
        hybrid_pred  = hybrid_val_pred,
        hybrid_score = hybrid_val_cal,
        split_name   = "Val",
    )

    # ------------------------------------------------------------------
    # Step 10: Final evaluation on TEST set (HELD-OUT — never touched before)
    # ------------------------------------------------------------------
    print("\n\nGenerating TEST set predictions ...")
    test_probs = get_probabilities(models, X_test, split_name="Test")

    hybrid_test_raw = compute_hybrid_score(
        test_probs["lr_prob_raw"], test_probs["rf_prob_raw"], w1, w2
    )
    hybrid_test_cal = compute_hybrid_score(
        test_probs["lr_prob_calibrated"], test_probs["rf_prob_calibrated"], w1, w2
    )
    hybrid_test_pred = (hybrid_test_cal >= dec_thr).astype(int)

    print("\nTest set evaluation ...")
    test_summary = evaluate_all(
        y_true       = y_test,
        lr_pred      = test_probs["lr_pred"],
        lr_prob      = test_probs["lr_prob_raw"],
        rf_pred      = test_probs["rf_pred"],
        rf_prob      = test_probs["rf_prob_raw"],
        hybrid_pred  = hybrid_test_pred,
        hybrid_score = hybrid_test_cal,
        split_name   = "Test",
    )

    # ------------------------------------------------------------------
    # Step 11: Feature importance and traffic pattern analysis
    # ------------------------------------------------------------------
    print("\n\nAnalysing feature importance and traffic patterns ...")
    df_imp = analyse_feature_importance(models["rf"], feature_names)

    top_features = df_imp["feature"].head(8).tolist()
    analyse_traffic_patterns(X_train, y_train, top_features=top_features)

    # ------------------------------------------------------------------
    # Step 12: Save predictions for test set
    # ------------------------------------------------------------------
    print("\n\nSaving test set predictions ...")
    save_predictions(
        meta            = meta_test,
        lr_prob_raw     = test_probs["lr_prob_raw"],
        lr_pred         = test_probs["lr_pred"],
        rf_prob_raw     = test_probs["rf_prob_raw"],
        rf_pred         = test_probs["rf_pred"],
        hybrid_score_raw= hybrid_test_raw,
        hybrid_score_cal= hybrid_test_cal,
        hybrid_pred     = hybrid_test_pred,
        low_thr         = low_thr,
        high_thr        = high_thr,
        split_name      = "test",
    )

    # Also save validation predictions (useful for dashboard)
    save_predictions(
        meta            = meta_val,
        lr_prob_raw     = val_probs["lr_prob_raw"],
        lr_pred         = val_probs["lr_pred"],
        rf_prob_raw     = val_probs["rf_prob_raw"],
        rf_pred         = val_probs["rf_pred"],
        hybrid_score_raw= hybrid_val_raw,
        hybrid_score_cal= hybrid_val_cal,
        hybrid_pred     = hybrid_val_pred,
        low_thr         = low_thr,
        high_thr        = high_thr,
        split_name      = "val",
    )

    # ------------------------------------------------------------------
    # Step 13: Save model artefacts
    # ------------------------------------------------------------------
    print("\n\nSaving model artefacts ...")
    save_models(models)

    # ------------------------------------------------------------------
    # Reproducibility metadata
    # ------------------------------------------------------------------
    elapsed = round(time.time() - run_start, 1)
    metadata = {
        "dataset_version":   DATASET_VERSION,
        "dataset_note":      DATASET_NOTE,
        "random_seed":       RANDOM_SEED,
        "feature_list":      FEATURE_COLS,
        "n_features":        len(FEATURE_COLS),
        "split_method":      f"time-based: last {VAL_FRAC*100:.0f}% of training rows = validation",
        "n_train":           int(len(y_train)),
        "n_val":             int(len(y_val)),
        "n_test":            int(len(y_test)),
        "lr_params":         LR_PARAMS,
        "rf_params":         RF_PARAMS,
        "calibration_method": CALIBRATION_METHOD,
        "hybrid_w1_lr":      float(w1),
        "hybrid_w2_rf":      float(w2),
        "decision_threshold": float(dec_thr),
        "low_triage_threshold":  float(low_thr),
        "high_triage_threshold": float(high_thr),
        "val_evaluation_summary":  val_summary.to_dict(orient="records"),
        "test_evaluation_summary": test_summary.to_dict(orient="records"),
        "runtime_seconds":   elapsed,
    }

    os.makedirs(METRICS_DIR, exist_ok=True)
    meta_path = os.path.join(METRICS_DIR, "experiment_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"\n  Experiment metadata saved: {meta_path}")

    print(f"\n{'#'*70}")
    print(f"  Pipeline complete in {elapsed:.1f} s")
    print(f"  Results directory: artifacts/primary/")
    print(f"{'#'*70}\n")


if __name__ == "__main__":
    main()
