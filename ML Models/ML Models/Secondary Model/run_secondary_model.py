"""
run_secondary_model.py
======================
Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage
Secondary Dataset Pipeline — Completely Independent from the Primary Model

Pipeline steps
--------------
 1.  Load and inspect Secondary_Train_70.csv and Secondary_Test_30.csv
 2.  Build binary target (BENIGN=0, attack=1); retain multiclass labels
 3.  Define feature columns (no leakage — Label excluded)
 4.  Split training-file feature groups into training/calibration/tuning (~70/15/15)
 5.  Train Logistic Regression (with StandardScaler pipeline)
 6.  Train Random Forest (no scaling)
 7.  Freeze fitted base models; calibrate on the separate calibration subset
 8.  Distinguish raw probabilities from calibrated confidence scores
 9.  Tune hybrid weights on validation set (grid search over F1)
10.  Select optimal decision threshold on validation set
11.  Determine SOC triage bands from validation distribution
12.  Evaluate LR, RF, Hybrid on validation set (diagnostic)
13.  Retrospectively evaluate the supplied test file, including an unseen-feature subset
14.  Analyse Random Forest feature importance
15.  Compare feature distributions: normal vs attack traffic
16.  Save all artefacts (models, predictions, metrics, plots, config JSON)

Usage
-----
    python "ML Models/ML Models/Secondary Model/run_secondary_model.py"

Outputs
-------
    results/verified/secondary/ (override with IDS_SECONDARY_RESULTS_DIR)
        models/
            secondary_lr_pipeline.joblib
            secondary_lr_calibrated.joblib
            secondary_rf_model.joblib
            secondary_rf_calibrated.joblib
        predictions/
            secondary_predictions_val.csv
            secondary_predictions_test.csv
        metrics/
            secondary_evaluation_summary_val.csv
            secondary_evaluation_summary_test.csv
            secondary_feature_importance.csv
            secondary_feature_stats_by_class.csv
            secondary_experiment_config.json
            secondary_lr_report_val.txt / _test.txt
            secondary_rf_report_val.txt / _test.txt
            secondary_hybrid_report_val.txt / _test.txt
        plots/
            secondary_feature_importance.png
            secondary_feature_distribution_comparison.png
            secondary_cm_lr_val.png / _test.png
            secondary_cm_rf_val.png / _test.png
            secondary_cm_hybrid_val.png / _test.png
            secondary_roc_comparison_val.png / _test.png
            secondary_class_distribution.png
            secondary_triage_distribution_test.png
"""

# ============================================================
# Imports
# ============================================================
import json
import os
import sys
import time
import platform

# Force UTF-8 output so Unicode arrows don't crash cp1252 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
import joblib

from sklearn.linear_model    import LogisticRegression
from sklearn.ensemble        import RandomForestClassifier
from sklearn.preprocessing   import StandardScaler
from sklearn.pipeline        import Pipeline
from sklearn.calibration     import CalibratedClassifierCV
from sklearn.calibration     import calibration_curve
from sklearn.frozen          import FrozenEstimator
import sklearn
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.metrics         import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
    roc_curve,
)

# ============================================================
# Reproducibility
# ============================================================
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

# ============================================================
# Paths
# ============================================================
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
BASE_DIR     = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPT_DIR)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
from experiment_support import (
    feature_groups, grouped_development_split, metric_record,
    select_f1_threshold, sha256_file, triage_summary,
)
DATA_DIR     = os.path.join(BASE_DIR, "Raw Data", "Secondary data")
TRAIN_PATH   = os.path.join(DATA_DIR, "Secondary_Train_70.csv")
TEST_PATH    = os.path.join(DATA_DIR, "Secondary_Test_30.csv")

OUT_ROOT     = os.path.abspath(os.environ.get(
    "IDS_SECONDARY_RESULTS_DIR", SCRIPT_DIR   # default: same folder as the script
))
MODEL_DIR    = os.path.join(OUT_ROOT, "models")
PRED_DIR     = os.path.join(OUT_ROOT, "predictions")
METRICS_DIR  = os.path.join(OUT_ROOT, "metrics")
PLOTS_DIR    = os.path.join(OUT_ROOT, "plots")

# ============================================================
# Feature & target configuration
# ============================================================
# Original column name for the multiclass label
LABEL_COL = "Label"

# Binary target: BENIGN = 0, any attack = 1
BENIGN_CLASS = "BENIGN"

# Predictive features — Label excluded, no identifier columns present
FEATURE_COLS = [
    "Source Port",                   # source TCP/UDP port
    "Destination Port",              # destination TCP/UDP port
    "Total Fwd Packets",             # forward (client-->server) packet count
    "Total Backward Packets",        # backward (server-->client) packet count
    "Total Length of Fwd Packets",   # total bytes in forward direction
    "Total Length of Bwd Packets",   # total bytes in backward direction
    "total_packets",                 # sum of fwd + bwd packets
    "total_bytes",                   # sum of fwd + bwd bytes
    "bytes_per_packet",              # average bytes per packet
    "packet_asymmetry_ratio",        # directional packet imbalance
    "hour_of_day",                   # temporal: hour (0-23)
    "day_of_week",                   # temporal: day (0=Mon … 6=Sun)
]

# Validation fraction carved from training data
VAL_FRAC = 0.15

# Calibration method
CALIBRATION_METHOD = "isotonic"

# Logistic Regression hyperparameters
LR_PARAMS = {
    "C": 1.0,
    "max_iter": 1000,
    "solver": "lbfgs",
    "class_weight": "balanced",
    "random_state": RANDOM_SEED,
}

# Random Forest hyperparameters
RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": None,
    "min_samples_leaf": 2,
    "class_weight": "balanced",
    "random_state": RANDOM_SEED,
    "n_jobs": -1,
}

# Hybrid weight search grid (w_lr; w_rf = 1 - w_lr)
LR_WEIGHT_CANDIDATES = [i / 10 for i in range(11)]

# SOC triage level labels
TRIAGE_LOW    = "Low Suspicion"
TRIAGE_REVIEW = "Medium / Review"
TRIAGE_HIGH   = "High Suspicion"


# ============================================================
# Utility helpers
# ============================================================
def banner(msg):
    print("\n" + "=" * 70)
    print(f"  {msg}")
    print("=" * 70)


def sub(msg):
    print(f"\n  --> {msg}")


def _save_fig(name):
    path = os.path.join(PLOTS_DIR, name)
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"    Saved: {path}")


# ============================================================
# STEP 1 & 2 — Load data, build targets
# ============================================================
def load_data():
    banner("STEP 1-2 | Load datasets and build binary target")

    train_raw = pd.read_csv(TRAIN_PATH)
    test_raw  = pd.read_csv(TEST_PATH)

    print(f"\n  Train shape : {train_raw.shape}")
    print(f"  Test  shape : {test_raw.shape}")
    print(f"\n  Columns     : {list(train_raw.columns)}")

    # Validate before constructing labels; missing labels must not become attacks.
    for name, frame in [("development", train_raw), ("test", test_raw)]:
        if frame[LABEL_COL].isna().any():
            raise ValueError(f"Missing {name} labels")
        frame[LABEL_COL] = frame[LABEL_COL].astype(str).str.strip()
        if frame[LABEL_COL].eq("").any() or not frame[LABEL_COL].eq(BENIGN_CLASS).any():
            raise ValueError(f"Invalid {name} labels or missing expected BENIGN label")
        if not np.isfinite(frame[FEATURE_COLS].to_numpy(dtype=float)).all():
            raise ValueError(f"Non-finite or missing {name} features")
        frame["row_index"] = np.arange(len(frame))

    # ---- binary target ----
    train_raw["label_binary"]     = (train_raw[LABEL_COL] != BENIGN_CLASS).astype(int)
    train_raw["label_multiclass"] = train_raw[LABEL_COL]

    test_raw["label_binary"]      = (test_raw[LABEL_COL] != BENIGN_CLASS).astype(int)
    test_raw["label_multiclass"]  = test_raw[LABEL_COL]

    # ---- class distribution ----
    print("\n  Training class distribution (multiclass):")
    for cls, cnt in train_raw[LABEL_COL].value_counts().items():
        tag = "[ATTACK]" if cls != BENIGN_CLASS else "[NORMAL]"
        print(f"    {tag:10s}  {cls:<35s}  {cnt:>6d}  ({cnt/len(train_raw)*100:.1f}%)")

    print("\n  Training binary distribution:")
    for lbl, cnt in train_raw["label_binary"].value_counts().sort_index().items():
        name = "NORMAL" if lbl == 0 else "ATTACK"
        print(f"    {name}: {cnt:>6d}  ({cnt/len(train_raw)*100:.1f}%)")

    print("\n  Test class distribution (multiclass):")
    for cls, cnt in test_raw[LABEL_COL].value_counts().items():
        tag = "[ATTACK]" if cls != BENIGN_CLASS else "[NORMAL]"
        print(f"    {tag:10s}  {cls:<35s}  {cnt:>6d}  ({cnt/len(test_raw)*100:.1f}%)")

    print("\n  Test binary distribution:")
    for lbl, cnt in test_raw["label_binary"].value_counts().sort_index().items():
        name = "NORMAL" if lbl == 0 else "ATTACK"
        print(f"    {name}: {cnt:>6d}  ({cnt/len(test_raw)*100:.1f}%)")

    # ---- missing / inf check ----
    num_cols = train_raw[FEATURE_COLS].select_dtypes(include=[np.number]).columns
    train_missing = train_raw[FEATURE_COLS].isnull().sum().sum()
    test_missing  = test_raw[FEATURE_COLS].isnull().sum().sum()
    train_inf = np.isinf(train_raw[num_cols]).sum().sum()
    test_inf  = np.isinf(test_raw[num_cols]).sum().sum()
    print(f"\n  Missing values — train: {train_missing}, test: {test_missing}")
    print(f"  Infinite values — train: {train_inf}, test: {test_inf}")

    # ---- plot class distributions ----
    _plot_class_distribution(train_raw, test_raw)

    return train_raw, test_raw


def _plot_class_distribution(train_df, test_df):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("Secondary Dataset — Class Distribution", fontsize=13, fontweight="bold")

    for ax, df, title in [(axes[0], train_df, "Training Set (70 k)"),
                          (axes[1], test_df,  "Test Set (30 k)")]:
        counts = df[LABEL_COL].value_counts()
        colours = ["#2ecc71" if c == BENIGN_CLASS else "#e74c3c" for c in counts.index]
        bars = ax.bar(range(len(counts)), counts.values, color=colours, edgecolor="white")
        ax.set_xticks(range(len(counts)))
        ax.set_xticklabels(counts.index, rotation=40, ha="right", fontsize=8)
        ax.set_title(title, fontweight="bold")
        ax.set_ylabel("Count")
        for bar, val in zip(bars, counts.values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 50,
                    str(val), ha="center", va="bottom", fontsize=7)

    fig.legend(
        handles=[plt.Rectangle((0,0),1,1, color="#2ecc71", label="Normal / BENIGN"),
                 plt.Rectangle((0,0),1,1, color="#e74c3c", label="Attack")],
        loc="lower center", ncol=2, frameon=False, fontsize=9
    )
    plt.tight_layout(rect=[0, 0.05, 1, 1])
    _save_fig("secondary_class_distribution.png")


# ============================================================
# STEP 3 — Train / Validation split (from training data only)
# ============================================================
def split_train_val(train_raw):
    """Return independent development subsets, grouping identical feature vectors."""
    banner("STEP 3 | Feature-group-separated training / calibration / tuning")
    indices = grouped_development_split(train_raw[FEATURE_COLS], train_raw.label_binary, RANDOM_SEED)
    subsets = {name: train_raw.iloc[index].copy() for name, index in indices.items()}
    for name, subset in subsets.items():
        print(f"  {name}: {len(subset)} rows, attack rate {subset.label_binary.mean():.4f}")
    return subsets


# ============================================================
# STEP 4 & 5 — Train LR and RF, then calibrate on val set
# ============================================================
def train_models(X_train, y_train, X_cal, y_cal):
    banner("STEP 4-5 | Train LR/RF; calibrate frozen models on calibration subset")

    # ---- Logistic Regression with StandardScaler pipeline ----
    sub("Training Logistic Regression (with StandardScaler pipeline) …")
    lr_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("lr",     LogisticRegression(**LR_PARAMS)),
    ])
    lr_pipeline.fit(X_train, y_train)
    print("    LR pipeline trained.")

    # ---- Random Forest (no scaling) ----
    sub("Training Random Forest (no scaling) …")
    rf_model = RandomForestClassifier(**RF_PARAMS)
    rf_model.fit(X_train, y_train)
    print("    RF model trained.")

    # FrozenEstimator preserves models fitted on training data. Calibration and
    # threshold tuning use separate records and separate feature groups.
    sub("Calibrating frozen LR on calibration subset (isotonic) …")
    lr_calibrated = CalibratedClassifierCV(
        estimator=FrozenEstimator(lr_pipeline), method=CALIBRATION_METHOD
    )
    lr_calibrated.fit(X_cal, y_cal)
    print("    LR calibrated.")

    sub("Calibrating frozen RF on calibration subset (isotonic) …")
    rf_calibrated = CalibratedClassifierCV(
        estimator=FrozenEstimator(rf_model), method=CALIBRATION_METHOD
    )
    rf_calibrated.fit(X_cal, y_cal)
    print("    RF calibrated.")

    # ---- Save models ----
    joblib.dump(lr_pipeline,   os.path.join(MODEL_DIR, "secondary_lr_pipeline.joblib"))
    joblib.dump(lr_calibrated, os.path.join(MODEL_DIR, "secondary_lr_calibrated.joblib"))
    joblib.dump(rf_model,      os.path.join(MODEL_DIR, "secondary_rf_model.joblib"))
    joblib.dump(rf_calibrated, os.path.join(MODEL_DIR, "secondary_rf_calibrated.joblib"))
    print("\n  Models saved to:", MODEL_DIR)

    return {
        "lr_pipeline":   lr_pipeline,
        "lr_calibrated": lr_calibrated,
        "rf_model":      rf_model,
        "rf_calibrated": rf_calibrated,
    }


# ============================================================
# STEP 6 — Get probabilities (raw and calibrated)
# ============================================================
def get_probabilities(models, X, split_name=""):
    """
    Returns a dict with raw (uncalibrated) and calibrated attack probabilities
    from both LR and RF, plus hard predictions.

    Raw probabilities  — direct output of predict_proba() on the base models.
    Calibrated scores  — output of CalibratedClassifierCV.predict_proba().
    These are clearly distinguished throughout the pipeline.
    """
    sub(f"Computing probabilities [{split_name}] …")

    lr_prob_raw  = models["lr_pipeline"].predict_proba(X)[:, 1]
    rf_prob_raw  = models["rf_model"].predict_proba(X)[:, 1]
    lr_prob_cal  = models["lr_calibrated"].predict_proba(X)[:, 1]
    rf_prob_cal  = models["rf_calibrated"].predict_proba(X)[:, 1]

    lr_pred = (lr_prob_cal >= 0.5).astype(int)
    rf_pred = (rf_prob_cal >= 0.5).astype(int)

    print(f"    LR raw prob  — mean: {lr_prob_raw.mean():.4f}  std: {lr_prob_raw.std():.4f}")
    print(f"    LR cal score — mean: {lr_prob_cal.mean():.4f}  std: {lr_prob_cal.std():.4f}")
    print(f"    RF raw prob  — mean: {rf_prob_raw.mean():.4f}  std: {rf_prob_raw.std():.4f}")
    print(f"    RF cal score — mean: {rf_prob_cal.mean():.4f}  std: {rf_prob_cal.std():.4f}")

    return {
        "lr_prob_raw": lr_prob_raw,
        "lr_prob_cal": lr_prob_cal,
        "lr_pred":     lr_pred,
        "rf_prob_raw": rf_prob_raw,
        "rf_prob_cal": rf_prob_cal,
        "rf_pred":     rf_pred,
    }


# ============================================================
# STEP 7-8-9 — Hybrid tuning on validation set
# ============================================================
def tune_hybrid(lr_prob_cal, rf_prob_cal, y_val):
    """Joint weight/threshold search on tuning only, including single-model endpoints."""
    results = []
    for weight in LR_WEIGHT_CANDIDATES:
        scores = weight * lr_prob_cal + (1 - weight) * rf_prob_cal
        selected = select_f1_threshold(scores, y_val)
        results.append({"w1_lr": weight, "w2_rf": 1 - weight,
                        "f1": selected["f1"], "threshold": selected["threshold"],
                        "recall": float(recall_score(y_val, scores >= selected["threshold"]))})
    # Deterministic ties prefer lower LR weight; no artificial hybrid advantage.
    best = max(results, key=lambda row: (round(row["f1"], 12), -row["w1_lr"]))
    scores = best["w1_lr"] * lr_prob_cal + best["w2_rf"] * rf_prob_cal
    threshold = best["threshold"]
    low = max(0.0, min(float(np.percentile(scores[y_val == 0], 90)), threshold))
    high = min(1.0, max(float(np.percentile(scores[y_val == 1], 30)), threshold))
    if low >= high:
        low, high = max(0.0, threshold - 0.05), min(1.0, threshold + 0.05)
    return {"w1_lr": best["w1_lr"], "w2_rf": best["w2_rf"],
            "decision_threshold": threshold,
            "low_triage_threshold": low, "high_triage_threshold": high,
            "weight_search_results": results,
            "lr_threshold": select_f1_threshold(lr_prob_cal, y_val)["threshold"],
            "rf_threshold": select_f1_threshold(rf_prob_cal, y_val)["threshold"],
            "triage_method": "Heuristic normal p90 / attack p30 on tuning, bounded by decision threshold; no risk guarantee",
            "hybrid_probability_note": "Weighted calibrated base probabilities; the blend is not independently calibrated."}


def compute_hybrid_score(lr_prob, rf_prob, w1, w2):
    return w1 * lr_prob + w2 * rf_prob


def apply_triage(scores, low_thr, high_thr):
    levels = []
    for s in scores:
        if s < low_thr:
            levels.append(TRIAGE_LOW)
        elif s >= high_thr:
            levels.append(TRIAGE_HIGH)
        else:
            levels.append(TRIAGE_REVIEW)
    return np.array(levels)


# ============================================================
# STEP 10-12 — Evaluation helpers
# ============================================================
def _classification_report_str(y_true, y_pred, name):
    return (
        f"=== {name} ===\n" +
        classification_report(y_true, y_pred,
                              labels=[0, 1], target_names=["Normal (0)", "Attack (1)"],
                              digits=4, zero_division=0)
    )


def _compute_metrics(y_true, y_pred, y_prob, model_name, split):
    return metric_record(y_true, y_pred, y_prob, model_name, split)


def _plot_confusion_matrix(y_true, y_pred, model_name, split):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    fig, ax = plt.subplots(figsize=(5, 4))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", ax=ax,
                xticklabels=["Normal", "Attack"],
                yticklabels=["Normal", "Attack"])
    ax.set_title(f"{model_name} — Confusion Matrix ({split})", fontweight="bold")
    ax.set_ylabel("True Label")
    ax.set_xlabel("Predicted Label")
    fname = f"secondary_cm_{model_name.lower().replace(' ', '_')}_{split.lower()}.png"
    _save_fig(fname)
    return fname


def _plot_roc_curves(y_true, lr_prob, rf_prob, hybrid_prob, split):
    fig, ax = plt.subplots(figsize=(7, 5))
    for prob, label, colour in [
        (lr_prob,     "Logistic Regression", "#3498db"),
        (rf_prob,     "Random Forest",       "#e67e22"),
        (hybrid_prob, "Hybrid Model",        "#8e44ad"),
    ]:
        try:
            fpr, tpr, _ = roc_curve(y_true, prob)
            auc = roc_auc_score(y_true, prob)
            ax.plot(fpr, tpr, label=f"{label}  (AUC={auc:.4f})", color=colour)
        except Exception:
            pass
    ax.plot([0, 1], [0, 1], "k--", lw=0.8)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title(f"ROC Curves — Secondary Model ({split})", fontweight="bold")
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3)
    _save_fig(f"secondary_roc_comparison_{split.lower()}.png")


def evaluate_all(y_true, probs, lr_pred, rf_pred, hybrid_pred,
                 hybrid_cal_score, low_thr, high_thr, split):
    banner(f"STEP 10-12 | Evaluation on {split} set")

    rows = []
    for (name, pred, prob) in [
        ("Logistic Regression", lr_pred,     probs["lr_prob_cal"]),
        ("Random Forest",       rf_pred,     probs["rf_prob_cal"]),
        ("Hybrid Model",        hybrid_pred, hybrid_cal_score),
    ]:
        metrics = _compute_metrics(y_true, pred, prob, name, split)
        rows.append(metrics)

        rep = _classification_report_str(y_true, pred, f"{name} [{split}]")
        print(f"\n{rep}")
        print(f"  ROC-AUC : {metrics['roc_auc']:.4f}")
        print(f"  TP={metrics['TP']}  TN={metrics['TN']}  "
              f"FP={metrics['FP']}  FN={metrics['FN']}  "
              f"<-- FN = missed attacks")

        # Save text report
        tag = name.lower().replace(" ", "_")
        report_path = os.path.join(METRICS_DIR,
                                   f"secondary_{tag}_report_{split.lower()}.txt")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(rep)
            f.write(f"\nROC-AUC: {metrics['roc_auc']:.4f}\n")
            f.write(f"TP={metrics['TP']}  TN={metrics['TN']}  "
                    f"FP={metrics['FP']}  FN={metrics['FN']}\n")

        # Confusion matrix plot
        _plot_confusion_matrix(y_true, pred, name, split)

    # ROC curve
    _plot_roc_curves(
        y_true,
        lr_prob=probs["lr_prob_cal"],
        rf_prob=probs["rf_prob_cal"],
        hybrid_prob=hybrid_cal_score,
        split=split,
    )

    summary_df = pd.DataFrame(rows)
    return summary_df


# ============================================================
# STEP 13 — Feature importance
# ============================================================
def analyse_feature_importance(rf_model, feature_names):
    banner("STEP 13 | Random Forest Feature Importance")

    importances = rf_model.feature_importances_
    df_imp = pd.DataFrame({
        "feature":    feature_names,
        "importance": importances,
    }).sort_values("importance", ascending=False).reset_index(drop=True)

    print("\n  Feature Importances:")
    for _, row in df_imp.iterrows():
        bar = "█" * int(row["importance"] * 200)
        print(f"    {row['feature']:<40s}  {row['importance']:.4f}  {bar}")

    # Save CSV
    df_imp.to_csv(
        os.path.join(METRICS_DIR, "secondary_feature_importance.csv"), index=False
    )

    # Plot
    fig, ax = plt.subplots(figsize=(9, 6))
    colours = plt.cm.RdYlGn(np.linspace(0.9, 0.1, len(df_imp)))
    ax.barh(df_imp["feature"][::-1], df_imp["importance"][::-1],
            color=colours[::-1], edgecolor="white")
    ax.set_xlabel("Gini Importance", fontsize=11)
    ax.set_title("Random Forest Feature Importance\n(Secondary Dataset)", fontweight="bold")
    ax.xaxis.set_major_formatter(mticker.FormatStrFormatter("%.3f"))
    for i, (imp, feat) in enumerate(zip(df_imp["importance"][::-1],
                                        df_imp["feature"][::-1])):
        ax.text(imp + 0.002, i, f"{imp:.4f}", va="center", fontsize=8)
    plt.tight_layout()
    _save_fig("secondary_feature_importance.png")

    return df_imp


# ============================================================
# STEP 14 — Feature distribution comparison
# ============================================================
def analyse_traffic_patterns(X_train, y_train, feature_names, top_n=8):
    banner("STEP 14 | Normal vs Attack Traffic Feature Comparison")

    df = pd.DataFrame(X_train, columns=feature_names)
    df["label"] = y_train

    records = []
    for feat in feature_names:
        normal_vals = df.loc[df["label"] == 0, feat]
        attack_vals = df.loc[df["label"] == 1, feat]
        records.append({
            "feature":        feat,
            "normal_mean":    round(normal_vals.mean(), 4),
            "normal_median":  round(normal_vals.median(), 4),
            "normal_std":     round(normal_vals.std(), 4),
            "attack_mean":    round(attack_vals.mean(), 4),
            "attack_median":  round(attack_vals.median(), 4),
            "attack_std":     round(attack_vals.std(), 4),
        })

    df_stats = pd.DataFrame(records)
    df_stats.to_csv(
        os.path.join(METRICS_DIR, "secondary_feature_stats_by_class.csv"), index=False
    )

    print("\n  Feature Stats (Normal vs Attack):")
    print(f"  {'Feature':<40s}  {'NormMean':>10}  {'AtkMean':>10}  {'Ratio':>8}")
    for _, row in df_stats.iterrows():
        ratio = (row["attack_mean"] / row["normal_mean"]
                 if row["normal_mean"] != 0 else float("nan"))
        print(f"  {row['feature']:<40s}  {row['normal_mean']:>10.2f}  "
              f"{row['attack_mean']:>10.2f}  {ratio:>8.2f}x")

    # ---- Plot top N features ----
    top_features = feature_names[:top_n]
    fig, axes = plt.subplots(2, 4, figsize=(16, 8))
    axes = axes.ravel()
    fig.suptitle("Normal vs Attack Traffic — Feature Distributions\n(Secondary Dataset)",
                 fontsize=12, fontweight="bold")

    for i, feat in enumerate(top_features):
        ax = axes[i]
        normal_vals = df.loc[df["label"] == 0, feat].clip(
            upper=df.loc[df["label"] == 0, feat].quantile(0.99)
        )
        attack_vals = df.loc[df["label"] == 1, feat].clip(
            upper=df.loc[df["label"] == 1, feat].quantile(0.99)
        )
        ax.hist(normal_vals, bins=40, alpha=0.6, color="#2ecc71",
                label="Normal", density=True)
        ax.hist(attack_vals, bins=40, alpha=0.6, color="#e74c3c",
                label="Attack", density=True)
        ax.set_title(feat, fontsize=9, fontweight="bold")
        ax.set_xlabel("Value", fontsize=8)
        ax.set_ylabel("Density", fontsize=8)
        ax.tick_params(labelsize=7)
        ax.legend(fontsize=7)

    for j in range(len(top_features), len(axes)):
        axes[j].set_visible(False)

    plt.tight_layout()
    _save_fig("secondary_feature_distribution_comparison.png")

    return df_stats


# ============================================================
# STEP 15 — Save predictions CSV
# ============================================================
def save_predictions(meta_df, probs, hybrid_score_raw, hybrid_score_cal,
                     hybrid_pred, triage_levels, split):
    df_out = meta_df[["row_index", "label_multiclass", "label_binary"]].reset_index(drop=True).copy()
    for key, source in [("lr_prob_raw", "lr_prob_raw"), ("lr_prob_calibrated", "lr_prob_cal"),
                        ("rf_prob_raw", "rf_prob_raw"), ("rf_prob_calibrated", "rf_prob_cal"),
                        ("lr_pred", "lr_pred"), ("rf_pred", "rf_pred")]:
        df_out[key] = probs[source]
    df_out["lr_pred_raw"] = (probs["lr_prob_raw"] >= 0.5).astype(int)
    df_out["rf_pred_raw"] = (probs["rf_prob_raw"] >= 0.5).astype(int)
    df_out["hybrid_score_raw"] = hybrid_score_raw
    df_out["hybrid_score_calibrated"] = hybrid_score_cal
    df_out["hybrid_pred"] = hybrid_pred
    df_out["triage_level"] = triage_levels
    path = os.path.join(PRED_DIR, f"secondary_predictions_{split.lower()}.csv")
    df_out.to_csv(path, index=False)
    triage_summary(df_out).to_csv(os.path.join(METRICS_DIR, f"secondary_triage_{split.lower()}.csv"), index=False)
    return df_out


def plot_triage_distribution(triage_levels, y_true, split):
    levels_order = [TRIAGE_LOW, TRIAGE_REVIEW, TRIAGE_HIGH]
    colours = {"Low Suspicion": "#2ecc71",
               "Medium / Review": "#f39c12",
               "High Suspicion": "#e74c3c"}

    df = pd.DataFrame({"triage": triage_levels, "true": y_true})
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle(f"SOC Triage Level Distribution — Secondary Model ({split})",
                 fontsize=12, fontweight="bold")

    # Left: overall triage counts
    ax = axes[0]
    counts = df["triage"].value_counts().reindex(levels_order, fill_value=0)
    bars = ax.bar(counts.index,
                  counts.values,
                  color=[colours[l] for l in counts.index],
                  edgecolor="white", linewidth=0.8)
    ax.set_ylabel("Count")
    ax.set_title("Overall Triage Distribution")
    for bar, val in zip(bars, counts.values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 50,
                str(val), ha="center", va="bottom", fontsize=9)

    # Right: triage × true label stacked
    ax2 = axes[1]
    pivot = df.groupby(["triage", "true"]).size().unstack(fill_value=0)
    pivot = pivot.reindex(levels_order, fill_value=0)
    pivot.columns = ["Normal", "Attack"]
    bottom = np.zeros(len(pivot))
    for col, colour in [("Normal", "#2ecc71"), ("Attack", "#e74c3c")]:
        ax2.bar(pivot.index, pivot[col], bottom=bottom,
                label=col, color=colour, edgecolor="white", linewidth=0.8, alpha=0.85)
        bottom += pivot[col].values
    ax2.set_ylabel("Count")
    ax2.set_title("Triage Level by True Label")
    ax2.legend()

    plt.tight_layout()
    _save_fig(f"secondary_triage_distribution_{split.lower()}.png")


# ============================================================
# STEP 17 — Save experiment config JSON
# ============================================================
def detailed_diagnostics(labels, probs, summary, split):
    rows = summary.to_dict(orient="records")
    for tag in ["lr", "rf"]:
        for kind, key in [("raw", f"{tag}_prob_raw"), ("calibrated", f"{tag}_prob_cal")]:
            rows.append(metric_record(labels, probs[key] >= 0.5, probs[key],
                                      f"{tag.upper()} {kind} @0.5", split))
    pd.DataFrame(rows).to_csv(os.path.join(METRICS_DIR, f"secondary_detailed_metrics_{split.lower()}.csv"), index=False)
    fig, ax = plt.subplots(figsize=(6, 5))
    for label, key in [("LR raw", "lr_prob_raw"), ("LR calibrated", "lr_prob_cal"),
                       ("RF raw", "rf_prob_raw"), ("RF calibrated", "rf_prob_cal")]:
        observed, predicted = calibration_curve(labels, probs[key], n_bins=10, strategy="uniform")
        ax.plot(predicted, observed, marker="o", label=label)
    ax.plot([0, 1], [0, 1], "--", color="gray")
    ax.set(xlabel="Predicted attack probability", ylabel="Observed attack fraction",
           title=f"Secondary reliability ({split})")
    ax.legend(fontsize=8)
    fig.tight_layout()
    _save_fig(f"secondary_reliability_{split.lower()}.png")


def main():
    run_start = time.time()
    for directory in [MODEL_DIR, PRED_DIR, METRICS_DIR, PLOTS_DIR]:
        os.makedirs(directory, exist_ok=True)
    banner("CORRECTED SECONDARY EXPERIMENT | retrospective re-evaluation")
    train_raw, test_raw = load_data()
    subsets = split_train_val(train_raw)
    train, calibration, tuning = [subsets[k] for k in ["train", "calibration", "tuning"]]
    models = train_models(train[FEATURE_COLS].values, train.label_binary.values,
                          calibration[FEATURE_COLS].values, calibration.label_binary.values)
    val_probs = get_probabilities(models, tuning[FEATURE_COLS].values, "Tuning")
    hybrid_cfg = tune_hybrid(val_probs["lr_prob_cal"], val_probs["rf_prob_cal"], tuning.label_binary.values)
    w1, w2 = hybrid_cfg["w1_lr"], hybrid_cfg["w2_rf"]
    summaries = {}
    for split, frame, probs in [
        ("Val", tuning, val_probs),
        ("Test", test_raw, get_probabilities(models, test_raw[FEATURE_COLS].values, "Test")),
    ]:
        labels = frame.label_binary.values
        probs["lr_pred"] = (probs["lr_prob_cal"] >= hybrid_cfg["lr_threshold"]).astype(int)
        probs["rf_pred"] = (probs["rf_prob_cal"] >= hybrid_cfg["rf_threshold"]).astype(int)
        scores = compute_hybrid_score(probs["lr_prob_cal"], probs["rf_prob_cal"], w1, w2)
        raw_scores = compute_hybrid_score(probs["lr_prob_raw"], probs["rf_prob_raw"], w1, w2)
        predictions = (scores >= hybrid_cfg["decision_threshold"]).astype(int)
        levels = apply_triage(scores, hybrid_cfg["low_triage_threshold"], hybrid_cfg["high_triage_threshold"])
        summary = evaluate_all(labels, probs, probs["lr_pred"], probs["rf_pred"], predictions, scores,
                               hybrid_cfg["low_triage_threshold"], hybrid_cfg["high_triage_threshold"], split)
        summaries[split] = summary
        summary.to_csv(os.path.join(METRICS_DIR, f"secondary_evaluation_summary_{split.lower()}.csv"), index=False)
        saved = save_predictions(frame, probs, raw_scores, scores, predictions, levels, split)
        detailed_diagnostics(labels, probs, summary, split)
        plot_triage_distribution(levels, labels, split)
        if split == "Test":
            seen = np.isin(feature_groups(frame[FEATURE_COLS]), feature_groups(train_raw[FEATURE_COLS]))
            saved["features_seen_in_development"] = seen
            saved.to_csv(os.path.join(PRED_DIR, "secondary_predictions_test.csv"), index=False)
            unseen = ~seen
            novelty_rows = [metric_record(labels[unseen], pred[unseen], prob[unseen], name, "Test unseen features")
                            for name, pred, prob in [
                                ("Logistic Regression", probs["lr_pred"], probs["lr_prob_cal"]),
                                ("Random Forest", probs["rf_pred"], probs["rf_prob_cal"]),
                                ("Hybrid Model", predictions, scores)]]
            pd.DataFrame(novelty_rows).to_csv(os.path.join(METRICS_DIR, "secondary_unseen_feature_test.csv"), index=False)
    analyse_feature_importance(models["rf_model"], FEATURE_COLS)
    analyse_traffic_patterns(train[FEATURE_COLS].values, train.label_binary.values, FEATURE_COLS)
    manifest = pd.concat([
        subset[["row_index", "label_binary"]].assign(split=name)
        for name, subset in subsets.items()
    ], ignore_index=True)
    manifest.to_csv(os.path.join(METRICS_DIR, "secondary_split_manifest.csv"), index=False)
    config = {
        "protocol_version": "corrected-v2",
        "dataset_train": TRAIN_PATH, "dataset_test": TEST_PATH,
        "source_sha256": {TRAIN_PATH: sha256_file(TRAIN_PATH), TEST_PATH: sha256_file(TEST_PATH)},
        "random_seed": RANDOM_SEED, "feature_list": FEATURE_COLS, "n_features": len(FEATURE_COLS),
        "split_method": "Feature-group-stratified approximately 70/15/15 training/calibration/tuning; no shared feature groups",
        "n_train": len(train), "n_calibration": len(calibration), "n_val": len(tuning), "n_test": len(test_raw),
        "class_counts": {k: {str(label): int(n) for label, n in v.label_binary.value_counts().items()}
                         for k, v in subsets.items()},
        "lr_params": LR_PARAMS, "rf_params": RF_PARAMS, "calibration_method": CALIBRATION_METHOD,
        "note_raw_vs_calibrated": "Frozen base models calibrated on a separate calibration subset; tuning scores select all model thresholds. The weighted hybrid is not independently calibrated.",
        "hybrid_w1_lr": w1, "hybrid_w2_rf": w2,
        "decision_threshold": hybrid_cfg["decision_threshold"],
        "low_triage_threshold": hybrid_cfg["low_triage_threshold"],
        "high_triage_threshold": hybrid_cfg["high_triage_threshold"],
        "lr_threshold": hybrid_cfg["lr_threshold"], "rf_threshold": hybrid_cfg["rf_threshold"],
        "weight_search_results": hybrid_cfg["weight_search_results"], "triage_method": hybrid_cfg["triage_method"],
        "test_rows_with_features_seen_in_development": int(seen.sum()),
        "evaluation_caveats": [
            "Retrospective re-evaluation: original test results were previously inspected.",
            "Original train/test files contain overlapping feature vectors; supplementary unseen-feature metrics are provided.",
            "No timestamp/session identifiers remain, so session separation and future-traffic generalization cannot be established.",
            "Feature-group holdouts do not remove all forms of correlated traffic.",
            "Triage thresholds are exploratory; review fraction is not measured analyst time savings.",
        ],
        "dependencies": {"python": platform.python_version(), "sklearn": sklearn.__version__,
                         "pandas": pd.__version__, "numpy": np.__version__},
        "val_evaluation_summary": summaries["Val"].to_dict(orient="records"),
        "test_evaluation_summary": summaries["Test"].to_dict(orient="records"),
        "runtime_seconds": round(time.time() - run_start, 2),
    }
    with open(os.path.join(METRICS_DIR, "secondary_experiment_config.json"), "w", encoding="utf-8") as stream:
        json.dump(config, stream, indent=2)
    print(summaries["Test"].to_string(index=False))
    print("Corrected artifacts:", OUT_ROOT)


if __name__ == "__main__":
    main()
