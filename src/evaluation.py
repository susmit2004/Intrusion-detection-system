"""
evaluation.py
=============
Evaluates Logistic Regression, Random Forest, and the Hybrid Model.

Metrics computed
----------------
  Accuracy, Precision, Recall, F1-score, ROC-AUC
  Confusion Matrix (absolute counts + normalised)
  Classification Report (per-class breakdown)

Special attention is paid to RECALL because missed attacks (false
negatives) are the primary risk in SOC alert triage.

All metric values are computed from actual model outputs — no values
are hard-coded or invented.

Outputs
-------
  results/metrics/evaluation_summary.csv   – comparison table
  results/metrics/lr_report.txt
  results/metrics/rf_report.txt
  results/metrics/hybrid_report.txt
  results/plots/cm_lr.png
  results/plots/cm_rf.png
  results/plots/cm_hybrid.png
  results/plots/roc_comparison.png
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")   # non-interactive backend for headless environments
import matplotlib.pyplot as plt
import seaborn as sns
import os

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
    roc_curve,
)

from src.config import METRICS_DIR, PLOTS_DIR


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ensure_dirs() -> None:
    os.makedirs(METRICS_DIR, exist_ok=True)
    os.makedirs(PLOTS_DIR,   exist_ok=True)


def _compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray,
    model_name: str,
) -> dict:
    """Compute and return a dictionary of evaluation metrics."""
    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    try:
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        auc = float("nan")

    return {
        "Model":     model_name,
        "Accuracy":  round(acc,  4),
        "Precision": round(prec, 4),
        "Recall":    round(rec,  4),
        "F1":        round(f1,   4),
        "ROC_AUC":   round(auc,  4),
    }


def _plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    model_name: str,
    filename: str,
) -> None:
    """Save a confusion matrix heatmap (absolute + percentages)."""
    cm   = confusion_matrix(y_true, y_pred)
    cm_n = cm.astype(float) / cm.sum() * 100  # percentage

    labels = np.array([
        [f"{v}\n({p:.1f}%)" for v, p in zip(row_v, row_p)]
        for row_v, row_p in zip(cm, cm_n)
    ])

    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(
        cm, annot=labels, fmt="", cmap="Blues",
        xticklabels=["Normal (0)", "Attack (1)"],
        yticklabels=["Normal (0)", "Attack (1)"],
        ax=ax, linewidths=0.5,
    )
    ax.set_xlabel("Predicted Label", fontsize=11)
    ax.set_ylabel("True Label",      fontsize=11)
    ax.set_title(f"Confusion Matrix — {model_name}", fontsize=12, fontweight="bold")
    plt.tight_layout()
    path = os.path.join(PLOTS_DIR, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Confusion matrix saved: {path}")


def _plot_roc_curves(roc_data: list, filename: str = "roc_comparison.png") -> None:
    """
    Plot ROC curves for multiple models on the same axes.
    roc_data: list of (model_name, y_true, y_prob) tuples
    """
    fig, ax = plt.subplots(figsize=(7, 6))
    colors = ["#2196F3", "#4CAF50", "#FF5722"]

    for (name, y_true, y_prob), color in zip(roc_data, colors):
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        auc = roc_auc_score(y_true, y_prob)
        ax.plot(fpr, tpr, label=f"{name} (AUC={auc:.4f})", color=color, lw=2)

    ax.plot([0, 1], [0, 1], "k--", lw=1, label="Random Classifier")
    ax.set_xlabel("False Positive Rate", fontsize=11)
    ax.set_ylabel("True Positive Rate",  fontsize=11)
    ax.set_title("ROC Curve Comparison — LR / RF / Hybrid", fontsize=12, fontweight="bold")
    ax.legend(fontsize=10)
    ax.grid(alpha=0.3)
    plt.tight_layout()
    path = os.path.join(PLOTS_DIR, filename)
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  ROC comparison saved: {path}")


def _save_report(y_true, y_pred, model_name, filename):
    """Save sklearn classification_report to a text file."""
    report = classification_report(
        y_true, y_pred,
        target_names=["Normal (0)", "Attack (1)"],
        zero_division=0,
    )
    header = (
        f"Classification Report — {model_name}\n"
        f"{'='*50}\n"
        f"Note: Recall for Attack class = True Positive Rate.\n"
        f"Missing attacks (False Negatives) are critical in SOC triage;\n"
        f"maximise Attack Recall to minimise missed threats.\n"
        f"{'='*50}\n\n"
    )
    path = os.path.join(METRICS_DIR, filename)
    with open(path, "w") as f:
        f.write(header + report)
    print(f"  Classification report saved: {path}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate_all(
    y_true:       np.ndarray,
    lr_pred:      np.ndarray,
    lr_prob:      np.ndarray,
    rf_pred:      np.ndarray,
    rf_prob:      np.ndarray,
    hybrid_pred:  np.ndarray,
    hybrid_score: np.ndarray,
    split_name:   str = "Test",
) -> pd.DataFrame:
    """
    Compute evaluation metrics for LR, RF, and Hybrid on a given split.
    Saves confusion matrices, ROC curves, reports, and a summary CSV.

    Parameters
    ----------
    y_true        : ground-truth binary labels
    lr_pred       : LR hard predictions (0/1)
    lr_prob       : LR class-1 probabilities (raw)
    rf_pred       : RF hard predictions (0/1)
    rf_prob       : RF class-1 probabilities (raw)
    hybrid_pred   : Hybrid hard predictions (using tuned threshold)
    hybrid_score  : Hybrid calibrated score (continuous, 0-1)
    split_name    : label for the split ('Val' or 'Test')

    Returns
    -------
    pd.DataFrame  : summary metrics table
    """
    _ensure_dirs()

    print(f"\n{'='*60}")
    print(f"  Evaluation on {split_name} set  (n={len(y_true)})")
    print(f"{'='*60}")

    suffix = split_name.lower()

    # ----- Logistic Regression -----
    lr_metrics = _compute_metrics(y_true, lr_pred, lr_prob, "Logistic Regression")
    _plot_confusion_matrix(y_true, lr_pred, "Logistic Regression", f"cm_lr_{suffix}.png")
    _save_report(y_true, lr_pred, "Logistic Regression", f"lr_report_{suffix}.txt")

    # ----- Random Forest -----
    rf_metrics = _compute_metrics(y_true, rf_pred, rf_prob, "Random Forest")
    _plot_confusion_matrix(y_true, rf_pred, "Random Forest", f"cm_rf_{suffix}.png")
    _save_report(y_true, rf_pred, "Random Forest", f"rf_report_{suffix}.txt")

    # ----- Hybrid -----
    hybrid_metrics = _compute_metrics(y_true, hybrid_pred, hybrid_score, "Hybrid")
    _plot_confusion_matrix(y_true, hybrid_pred, "Hybrid Model", f"cm_hybrid_{suffix}.png")
    _save_report(y_true, hybrid_pred, "Hybrid Model", f"hybrid_report_{suffix}.txt")

    # ----- ROC curves -----
    _plot_roc_curves(
        [
            ("Logistic Regression", y_true, lr_prob),
            ("Random Forest",       y_true, rf_prob),
            ("Hybrid",              y_true, hybrid_score),
        ],
        filename=f"roc_comparison_{suffix}.png",
    )

    # ----- Summary table -----
    summary = pd.DataFrame([lr_metrics, rf_metrics, hybrid_metrics])
    summary_path = os.path.join(METRICS_DIR, f"evaluation_summary_{suffix}.csv")
    summary.to_csv(summary_path, index=False)
    print(f"\n  Evaluation summary saved: {summary_path}")
    print()
    print(summary.to_string(index=False))
    print()

    # ----- Print confusion matrices in text -----
    for name, pred in [("LR", lr_pred), ("RF", rf_pred), ("Hybrid", hybrid_pred)]:
        cm = confusion_matrix(y_true, pred)
        tn, fp, fn, tp = cm.ravel()
        print(f"  {name:6s}  TN={tn:5d}  FP={fp:5d}  FN={fn:5d}  TP={tp:5d}  "
              f"  Missed attacks (FN)={fn}  "
              f"  False alarms (FP)={fp}")

    return summary
