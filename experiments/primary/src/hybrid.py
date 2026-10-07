"""
hybrid.py
=========
Implements the Confidence-Based Hybrid Model:

    Hybrid Score = w1 × LR_calibrated_prob + w2 × RF_calibrated_prob
    where w1 + w2 = 1

Key decisions
-------------
* w1 / w2 are optimised on the VALIDATION set by grid search over
  LR_WEIGHT_CANDIDATES. The optimisation criterion is F1 (harmonic mean
  of precision and recall at threshold 0.5) which balances false negatives
  (missed attacks) and false positives. Users can change the criterion
  to 'recall' if they want to prioritise missed-attack rate.
* The final binary decision threshold for the hybrid score is also
  selected on the validation set by maximising F1 (or recall) over a
  fine grid — NOT set to 0.5 by default.
* Three SOC triage bands are determined from the validation score
  distribution:
      Low Suspicion   : hybrid_score < low_threshold
      Review          : low_threshold ≤ hybrid_score < high_threshold
      High Suspicion  : hybrid_score ≥ high_threshold
* All thresholds and weights are saved to a JSON file for full
  reproducibility and dashboard consumption.
"""

import numpy as np
import pandas as pd
import json
import os
from sklearn.metrics import f1_score, recall_score

from src.config import (
    LR_WEIGHT_CANDIDATES,
    DEFAULT_LOW_THRESHOLD, DEFAULT_HIGH_THRESHOLD,
    RESULTS_DIR, METRICS_DIR,
)


# ---------------------------------------------------------------------------
# Weight optimisation
# ---------------------------------------------------------------------------

def optimise_weights(
    lr_prob_val: np.ndarray,
    rf_prob_val: np.ndarray,
    y_val:       np.ndarray,
    criterion:   str = "f1",
) -> dict:
    """
    Grid-search over LR_WEIGHT_CANDIDATES on the VALIDATION set.
    Returns the best w1 (LR weight) and corresponding w2 = 1 - w1.

    Parameters
    ----------
    criterion : 'f1' or 'recall'
        'recall' prioritises minimising false negatives (missed attacks),
        which is appropriate when the cost of missing an attack is high.
    """
    print(f"\n{'='*60}")
    print(f"  Optimising hybrid weights on validation set (criterion={criterion})")
    print(f"{'='*60}")

    best_score = -1.0
    best_w1    = 0.5
    results    = []

    for w1 in LR_WEIGHT_CANDIDATES:
        w2 = round(1.0 - w1, 10)
        hybrid = w1 * lr_prob_val + w2 * rf_prob_val
        preds  = (hybrid >= 0.5).astype(int)

        if criterion == "recall":
            score = recall_score(y_val, preds, zero_division=0)
        else:  # default: f1
            score = f1_score(y_val, preds, zero_division=0)

        results.append({"w1_lr": w1, "w2_rf": w2, criterion: round(score, 5)})
        print(f"  w1(LR)={w1:.1f}  w2(RF)={w2:.1f}  {criterion}={score:.4f}")

        if score > best_score:
            best_score = score
            best_w1    = w1

    best_w2 = round(1.0 - best_w1, 10)
    print(f"\n  Best: w1(LR)={best_w1}  w2(RF)={best_w2}  {criterion}={best_score:.4f}")

    return {
        "w1_lr": best_w1,
        "w2_rf": best_w2,
        "criterion": criterion,
        "best_score": best_score,
        "search_results": results,
    }


# ---------------------------------------------------------------------------
# Threshold selection
# ---------------------------------------------------------------------------

def select_threshold(
    hybrid_scores: np.ndarray,
    y_val:         np.ndarray,
    criterion:     str = "f1",
    n_steps:       int = 200,
) -> dict:
    """
    Sweep candidate decision thresholds on the validation hybrid scores
    and return the one that maximises the chosen criterion.

    Returns dict with keys: threshold, best_score, criterion
    """
    print(f"\n{'='*60}")
    print(f"  Selecting decision threshold on validation set (criterion={criterion})")
    print(f"{'='*60}")

    thresholds  = np.linspace(0.01, 0.99, n_steps)
    best_thr    = 0.5
    best_score  = -1.0

    for thr in thresholds:
        preds = (hybrid_scores >= thr).astype(int)
        if criterion == "recall":
            score = recall_score(y_val, preds, zero_division=0)
        else:
            score = f1_score(y_val, preds, zero_division=0)
        if score > best_score:
            best_score = score
            best_thr   = thr

    print(f"  Best threshold : {best_thr:.4f}  ({criterion}={best_score:.4f})")

    return {
        "threshold": float(best_thr),
        "best_score": float(best_score),
        "criterion": criterion,
    }


# ---------------------------------------------------------------------------
# SOC triage bands
# ---------------------------------------------------------------------------

def compute_triage_thresholds(
    hybrid_scores_val: np.ndarray,
    y_val:             np.ndarray,
) -> dict:
    """
    Set triage band boundaries from the validation score distribution.

    Strategy
    --------
    Divide the full [0, 1] score range into three bands using the
    overall score distribution on the validation set:
    - low_threshold  = 25th percentile of all validation hybrid scores
    - high_threshold = 75th percentile of all validation hybrid scores

    This produces three roughly balanced bands regardless of class ratio,
    with the low band capturing "clearly normal" scores, the high band
    capturing "clearly suspicious" scores, and the middle band being
    the analyst review zone.

    As a secondary check, the high threshold is adjusted so that it does
    not exceed the 95th percentile of attack scores (to avoid classifying
    most true attacks as "Review" rather than "High Suspicion").

    Fallback to config defaults if the validation set lacks enough samples.
    """
    if len(hybrid_scores_val) < 20:
        print("  WARNING: Too few samples for data-driven triage thresholds. "
              "Using config defaults.")
        return {
            "low_threshold":  DEFAULT_LOW_THRESHOLD,
            "high_threshold": DEFAULT_HIGH_THRESHOLD,
        }

    low_thr  = float(np.percentile(hybrid_scores_val, 25))
    high_thr = float(np.percentile(hybrid_scores_val, 75))

    # Adjust high threshold: cap at 95th percentile of attack scores so that
    # the bulk of true attacks fall in "High Suspicion" rather than "Review"
    attack_scores = hybrid_scores_val[y_val == 1]
    if len(attack_scores) >= 5:
        attack_p50 = float(np.percentile(attack_scores, 50))
        # high_thr should be ≤ median of attack scores for meaningful separation
        high_thr = min(high_thr, attack_p50)

    # Ensure 0.01 ≤ low < high ≤ 0.99
    low_thr  = max(0.01, low_thr)
    high_thr = min(0.99, high_thr)
    if low_thr >= high_thr:
        low_thr  = max(0.01, high_thr - 0.15)

    print(f"\n  SOC Triage thresholds (from validation distribution):")
    print(f"    Low Suspicion  : hybrid_score < {low_thr:.4f}")
    print(f"    Review         : {low_thr:.4f} <= hybrid_score < {high_thr:.4f}")
    print(f"    High Suspicion : hybrid_score >= {high_thr:.4f}")

    return {
        "low_threshold":  low_thr,
        "high_threshold": high_thr,
    }


# ---------------------------------------------------------------------------
# Hybrid score computation
# ---------------------------------------------------------------------------

def compute_hybrid_score(
    lr_prob: np.ndarray,
    rf_prob: np.ndarray,
    w1_lr:   float,
    w2_rf:   float,
) -> np.ndarray:
    """Weighted combination: Hybrid = w1*LR + w2*RF"""
    return w1_lr * lr_prob + w2_rf * rf_prob


def apply_triage(
    hybrid_scores: np.ndarray,
    low_thr:       float,
    high_thr:      float,
) -> list:
    """Map hybrid scores to SOC triage labels."""
    labels = []
    for s in hybrid_scores:
        if s < low_thr:
            labels.append("Low Suspicion")
        elif s < high_thr:
            labels.append("Review")
        else:
            labels.append("High Suspicion")
    return labels


# ---------------------------------------------------------------------------
# Full tuning pipeline (runs on validation set; test set never touched here)
# ---------------------------------------------------------------------------

def tune_hybrid(
    lr_prob_val: np.ndarray,
    rf_prob_val: np.ndarray,
    y_val:       np.ndarray,
    criterion:   str = "f1",
) -> dict:
    """
    Runs the complete hybrid tuning sequence on validation data:
      1. Optimise w1/w2
      2. Compute validation hybrid scores
      3. Select decision threshold
      4. Determine SOC triage thresholds

    Returns a config dict that is saved to JSON for reproducibility.
    """
    # Step 1: weight optimisation
    weight_result = optimise_weights(lr_prob_val, rf_prob_val, y_val, criterion)
    w1 = weight_result["w1_lr"]
    w2 = weight_result["w2_rf"]

    # Step 2: compute validation hybrid scores (using CALIBRATED probs)
    hybrid_val = compute_hybrid_score(lr_prob_val, rf_prob_val, w1, w2)

    # Step 3: threshold selection
    thr_result = select_threshold(hybrid_val, y_val, criterion)
    decision_threshold = thr_result["threshold"]

    # Step 4: triage thresholds
    triage_thresholds = compute_triage_thresholds(hybrid_val, y_val)
    config = {
        "w1_lr":             w1,
        "w2_rf":             w2,
        "decision_threshold": decision_threshold,
        "low_triage_threshold":  triage_thresholds["low_threshold"],
        "high_triage_threshold": triage_thresholds["high_threshold"],
        "weight_optimisation": weight_result,
        "threshold_optimisation": thr_result,
        "optimisation_criterion": criterion,
    }

    # Persist
    os.makedirs(METRICS_DIR, exist_ok=True)
    config_path = os.path.join(METRICS_DIR, "hybrid_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"\n  Hybrid configuration saved to: {config_path}")

    return config
