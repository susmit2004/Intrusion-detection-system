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
 4.  Carve validation set from training data only (stratified, 15 %)
 5.  Train Logistic Regression (with StandardScaler pipeline)
 6.  Train Random Forest (no scaling)
 7.  Probability calibration (isotonic) on validation set
 8.  Distinguish raw probabilities from calibrated confidence scores
 9.  Tune hybrid weights on validation set (grid search over F1)
10.  Select optimal decision threshold on validation set
11.  Determine SOC triage bands from validation distribution
12.  Evaluate LR, RF, Hybrid on validation set (diagnostic)
13.  Evaluate LR, RF, Hybrid on TEST set (final — never used before)
14.  Analyse Random Forest feature importance
15.  Compare feature distributions: normal vs attack traffic
16.  Save all artefacts (models, predictions, metrics, plots, config JSON)

Usage
-----
    python "ML Models/ML Models/Secondary Model/run_secondary_model.py"

Outputs
-------
    ML Models/ML Models/Secondary Model/
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
import warnings
warnings.filterwarnings("ignore")

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
DATA_DIR     = os.path.join(BASE_DIR, "Raw Data", "Secondary data")
TRAIN_PATH   = os.path.join(DATA_DIR, "Secondary_Train_70.csv")
TEST_PATH    = os.path.join(DATA_DIR, "Secondary_Test_30.csv")

OUT_ROOT     = SCRIPT_DIR
MODEL_DIR    = os.path.join(OUT_ROOT, "models")
PRED_DIR     = os.path.join(OUT_ROOT, "predictions")
METRICS_DIR  = os.path.join(OUT_ROOT, "metrics")
PLOTS_DIR    = os.path.join(OUT_ROOT, "plots")

for d in [MODEL_DIR, PRED_DIR, METRICS_DIR, PLOTS_DIR]:
    os.makedirs(d, exist_ok=True)

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
    "Total Fwd Packets",             # forward (client→server) packet count
    "Total Backward Packets",        # backward (server→client) packet count
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
LR_WEIGHT_CANDIDATES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

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
    print(f"\n  → {msg}")


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
    banner("STEP 3 | Stratified train/validation split (from training data only)")

    X_full = train_raw[FEATURE_COLS].values
    y_full = train_raw["label_binary"].values

    sss = StratifiedShuffleSplit(n_splits=1, test_size=VAL_FRAC, random_state=RANDOM_SEED)
    train_idx, val_idx = next(sss.split(X_full, y_full))

    X_train, y_train = X_full[train_idx], y_full[train_idx]
    X_val,   y_val   = X_full[val_idx],   y_full[val_idx]

    meta_train = train_raw.iloc[train_idx][["label_multiclass", "label_binary"]].reset_index(drop=True)
    meta_val   = train_raw.iloc[val_idx][["label_multiclass",   "label_binary"]].reset_index(drop=True)

    print(f"\n  Train  : {X_train.shape[0]:>6d} rows  "
          f"(attack rate: {y_train.mean()*100:.1f}%)")
    print(f"  Val    : {X_val.shape[0]:>6d} rows  "
          f"(attack rate: {y_val.mean()*100:.1f}%)")

    return X_train, y_train, X_val, y_val, meta_train, meta_val


# ============================================================
# STEP 4 & 5 — Train LR and RF, then calibrate on val set
# ============================================================
def train_models(X_train, y_train, X_val, y_val):
    banner("STEP 4-5 | Train Logistic Regression + Random Forest → Calibrate on validation")

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

    # ---- Calibrate both models on validation set ----
    # cv=None tells CalibratedClassifierCV that the base estimator is already
    # fitted; it will use the supplied X_val / y_val directly for calibration.
    # (sklearn >= 1.2 removed the legacy cv="prefit" string alias.)
    sub("Calibrating LR on validation set (isotonic) …")
    lr_calibrated = CalibratedClassifierCV(
        estimator=lr_pipeline, method=CALIBRATION_METHOD, cv=None
    )
    lr_calibrated.fit(X_val, y_val)
    print("    LR calibrated.")

    sub("Calibrating RF on validation set (isotonic) …")
    rf_calibrated = CalibratedClassifierCV(
        estimator=rf_model, method=CALIBRATION_METHOD, cv=None
    )
    rf_calibrated.fit(X_val, y_val)
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
    """
    Grid-search over LR weight candidates to find the combination that
    maximises F1 on the validation set.
    Threshold search done on the same validation set.
    Triage band boundaries set from validation score distribution.

    All decisions are made on validation data only.
    The test set is never touched here.
    """
    banner("STEP 7-9 | Hybrid weight + threshold + triage band tuning (validation only)")

    best_f1  = -1.0
    best_w1  = 0.5
    results  = []

    for w1 in LR_WEIGHT_CANDIDATES:
        w2 = round(1.0 - w1, 2)
        hybrid = w1 * lr_prob_cal + w2 * rf_prob_cal
        pred   = (hybrid >= 0.5).astype(int)
        f1     = f1_score(y_val, pred, zero_division=0)
        rec    = recall_score(y_val, pred, zero_division=0)
        results.append({"w1_lr": w1, "w2_rf": w2, "f1": f1, "recall": rec})
        if f1 > best_f1:
            best_f1 = f1
            best_w1 = w1

    best_w2 = round(1.0 - best_w1, 2)
    print(f"\n  Hybrid weight search results:")
    print(f"  {'w1_LR':>6}  {'w2_RF':>6}  {'F1':>8}  {'Recall':>8}")
    for r in results:
        marker = " ◄ best" if r["w1_lr"] == best_w1 else ""
        print(f"  {r['w1_lr']:>6.2f}  {r['w2_rf']:>6.2f}  "
              f"{r['f1']:>8.4f}  {r['recall']:>8.4f}{marker}")

    print(f"\n  Best weights: w_LR={best_w1:.2f}, w_RF={best_w2:.2f}  (F1={best_f1:.4f})")

    # Compute hybrid score with best weights
    hybrid_val = best_w1 * lr_prob_cal + best_w2 * rf_prob_cal

    # ---- Threshold optimisation on validation set ----
    sub("Searching optimal decision threshold on validation set …")
    thresholds  = np.linspace(0.01, 0.99, 199)
    best_thr    = 0.5
    best_thr_f1 = -1.0
    thr_records = []
    for thr in thresholds:
        pred = (hybrid_val >= thr).astype(int)
        f1   = f1_score(y_val, pred, zero_division=0)
        rec  = recall_score(y_val, pred, zero_division=0)
        pre  = precision_score(y_val, pred, zero_division=0)
        thr_records.append({"threshold": thr, "f1": f1, "recall": rec, "precision": pre})
        if f1 > best_thr_f1:
            best_thr_f1 = f1
            best_thr    = thr

    best_thr = float(round(best_thr, 4))
    print(f"  Optimal threshold (max F1 on val): {best_thr:.4f}  (F1={best_thr_f1:.4f})")

    # ---- Triage band thresholds from validation distribution ----
    sub("Setting SOC triage bands from validation hybrid score distribution …")
    low_thr  = float(np.percentile(hybrid_val[y_val == 0], 90))
    high_thr = float(np.percentile(hybrid_val[y_val == 1], 30))
    low_thr  = round(max(0.05, min(low_thr,  best_thr - 0.05)), 4)
    high_thr = round(max(best_thr + 0.05, min(high_thr, 0.95)), 4)

    print(f"  Triage band boundaries:")
    print(f"    Low Suspicion  : hybrid_score < {low_thr}")
    print(f"    Medium / Review: {low_thr} ≤ hybrid_score < {high_thr}")
    print(f"    High Suspicion : hybrid_score ≥ {high_thr}")

    return {
        "w1_lr":              best_w1,
        "w2_rf":              best_w2,
        "decision_threshold": best_thr,
        "low_triage_threshold":  low_thr,
        "high_triage_threshold": high_thr,
        "weight_search_results": results,
    }


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
                              target_names=["Normal (0)", "Attack (1)"],
                              digits=4, zero_division=0)
    )


def _compute_metrics(y_true, y_pred, y_prob, model_name, split):
    acc  = accuracy_score(y_true, y_pred)
    pre  = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    try:
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        auc = float("nan")
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    return {
        "model":       model_name,
        "split":       split,
        "accuracy":    round(acc, 4),
        "precision":   round(pre, 4),
        "recall":      round(rec, 4),
        "f1":          round(f1, 4),
        "roc_auc":     round(auc, 4),
        "TP":          int(tp),
        "TN":          int(tn),
        "FP":          int(fp),
        "FN":          int(fn),
    }


def _plot_confusion_matrix(y_true, y_pred, model_name, split):
    cm = confusion_matrix(y_true, y_pred)
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
              f"← FN = missed attacks")

        # Save text report
        tag = name.lower().replace(" ", "_")
        report_path = os.path.join(METRICS_DIR,
                                   f"secondary_{tag}_report_{split.lower()}.txt")
        with open(report_path, "w") as f:
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
    df_out = pd.DataFrame({
        "label_multiclass":      meta_df["label_multiclass"].values,
        "label_binary":          meta_df["label_binary"].values,
        "lr_prob_raw":           np.round(probs["lr_prob_raw"], 6),
        "lr_prob_calibrated":    np.round(probs["lr_prob_cal"], 6),
        "lr_pred":               probs["lr_pred"],
        "rf_prob_raw":           np.round(probs["rf_prob_raw"], 6),
        "rf_prob_calibrated":    np.round(probs["rf_prob_cal"], 6),
        "rf_pred":               probs["rf_pred"],
        "hybrid_score_raw":      np.round(hybrid_score_raw, 6),
        "hybrid_score_calibrated": np.round(hybrid_score_cal, 6),
        "hybrid_pred":           hybrid_pred,
        "triage_level":          triage_levels,
    })
    path = os.path.join(PRED_DIR, f"secondary_predictions_{split.lower()}.csv")
    df_out.to_csv(path, index=False)
    print(f"\n  Predictions saved: {path}  ({len(df_out)} rows)")
    return df_out


# ============================================================
# STEP 16 — Triage distribution plot
# ============================================================
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
def save_config(hybrid_cfg, feature_names, n_train, n_val, n_test,
                val_summary, test_summary, elapsed):
    config = {
        "dataset_train":      TRAIN_PATH,
        "dataset_test":       TEST_PATH,
        "random_seed":        RANDOM_SEED,
        "feature_list":       feature_names,
        "n_features":         len(feature_names),
        "split_method":       f"StratifiedShuffleSplit val_frac={VAL_FRAC} from training data only",
        "n_train":            int(n_train),
        "n_val":              int(n_val),
        "n_test":             int(n_test),
        "lr_params":          LR_PARAMS,
        "rf_params":          RF_PARAMS,
        "calibration_method": CALIBRATION_METHOD,
        "note_raw_vs_calibrated": (
            "lr_prob_raw / rf_prob_raw = direct predict_proba() output from base models. "
            "lr_prob_calibrated / rf_prob_calibrated = output of CalibratedClassifierCV "
            f"(method={CALIBRATION_METHOD}) fitted on validation set. "
            "Hybrid score uses calibrated probabilities."
        ),
        "hybrid_w1_lr":              float(hybrid_cfg["w1_lr"]),
        "hybrid_w2_rf":              float(hybrid_cfg["w2_rf"]),
        "decision_threshold":        float(hybrid_cfg["decision_threshold"]),
        "low_triage_threshold":      float(hybrid_cfg["low_triage_threshold"]),
        "high_triage_threshold":     float(hybrid_cfg["high_triage_threshold"]),
        "weight_search_results":     hybrid_cfg["weight_search_results"],
        "val_evaluation_summary":    val_summary.to_dict(orient="records"),
        "test_evaluation_summary":   test_summary.to_dict(orient="records"),
        "runtime_seconds":           elapsed,
    }
    path = os.path.join(METRICS_DIR, "secondary_experiment_config.json")
    with open(path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"\n  Experiment config saved: {path}")
    return config


# ============================================================
# MAIN ORCHESTRATION
# ============================================================
def main():
    run_start = time.time()

    banner("Confidence-Based Hybrid ML Framework — SECONDARY DATASET PIPELINE")
    print(f"  Script : {__file__}")
    print(f"  Train  : {TRAIN_PATH}")
    print(f"  Test   : {TEST_PATH}")
    print(f"  Output : {OUT_ROOT}")

    # ----------------------------------------------------------
    # 1-2: Load data, build targets
    # ----------------------------------------------------------
    train_raw, test_raw = load_data()

    # ----------------------------------------------------------
    # 3: Train / Val split (training data only)
    # ----------------------------------------------------------
    X_train, y_train, X_val, y_val, meta_train, meta_val = split_train_val(train_raw)

    # Prepare test features and metadata (NEVER touched until final eval)
    X_test  = test_raw[FEATURE_COLS].values
    y_test  = test_raw["label_binary"].values
    meta_test = test_raw[["label_multiclass", "label_binary"]].reset_index(drop=True)
    print(f"\n  Test   : {X_test.shape[0]:>6d} rows  "
          f"(attack rate: {y_test.mean()*100:.1f}%)")

    # ----------------------------------------------------------
    # 4-5: Train models + calibrate on val set
    # ----------------------------------------------------------
    models = train_models(X_train, y_train, X_val, y_val)

    # ----------------------------------------------------------
    # 6: Get probabilities for validation set
    # ----------------------------------------------------------
    val_probs = get_probabilities(models, X_val, split_name="Validation")

    # ----------------------------------------------------------
    # 7-9: Hybrid tuning (validation only)
    # ----------------------------------------------------------
    hybrid_cfg = tune_hybrid(
        lr_prob_cal=val_probs["lr_prob_cal"],
        rf_prob_cal=val_probs["rf_prob_cal"],
        y_val=y_val,
    )
    w1       = hybrid_cfg["w1_lr"]
    w2       = hybrid_cfg["w2_rf"]
    dec_thr  = hybrid_cfg["decision_threshold"]
    low_thr  = hybrid_cfg["low_triage_threshold"]
    high_thr = hybrid_cfg["high_triage_threshold"]

    # ----------------------------------------------------------
    # Hybrid scores for VALIDATION (using calibrated probs)
    # ----------------------------------------------------------
    hybrid_val_raw  = compute_hybrid_score(val_probs["lr_prob_raw"], val_probs["rf_prob_raw"], w1, w2)
    hybrid_val_cal  = compute_hybrid_score(val_probs["lr_prob_cal"], val_probs["rf_prob_cal"], w1, w2)
    hybrid_val_pred = (hybrid_val_cal >= dec_thr).astype(int)
    triage_val      = apply_triage(hybrid_val_cal, low_thr, high_thr)

    # ----------------------------------------------------------
    # 10-12: Evaluate on VALIDATION set (diagnostic)
    # ----------------------------------------------------------
    val_summary = evaluate_all(
        y_true=y_val,
        probs=val_probs,
        lr_pred=val_probs["lr_pred"],
        rf_pred=val_probs["rf_pred"],
        hybrid_pred=hybrid_val_pred,
        hybrid_cal_score=hybrid_val_cal,
        low_thr=low_thr,
        high_thr=high_thr,
        split="Val",
    )
    val_summary.to_csv(
        os.path.join(METRICS_DIR, "secondary_evaluation_summary_val.csv"), index=False
    )

    # Save validation predictions
    save_predictions(
        meta_df=meta_val,
        probs=val_probs,
        hybrid_score_raw=hybrid_val_raw,
        hybrid_score_cal=hybrid_val_cal,
        hybrid_pred=hybrid_val_pred,
        triage_levels=triage_val,
        split="val",
    )
    plot_triage_distribution(triage_val, y_val, split="Val")

    # ----------------------------------------------------------
    # FINAL: Get probabilities for TEST set (first time touching it)
    # ----------------------------------------------------------
    banner("FINAL EVALUATION | Test set — completely unseen until now")
    test_probs = get_probabilities(models, X_test, split_name="Test")

    hybrid_test_raw  = compute_hybrid_score(test_probs["lr_prob_raw"], test_probs["rf_prob_raw"], w1, w2)
    hybrid_test_cal  = compute_hybrid_score(test_probs["lr_prob_cal"], test_probs["rf_prob_cal"], w1, w2)
    hybrid_test_pred = (hybrid_test_cal >= dec_thr).astype(int)
    triage_test      = apply_triage(hybrid_test_cal, low_thr, high_thr)

    test_summary = evaluate_all(
        y_true=y_test,
        probs=test_probs,
        lr_pred=test_probs["lr_pred"],
        rf_pred=test_probs["rf_pred"],
        hybrid_pred=hybrid_test_pred,
        hybrid_cal_score=hybrid_test_cal,
        low_thr=low_thr,
        high_thr=high_thr,
        split="Test",
    )
    test_summary.to_csv(
        os.path.join(METRICS_DIR, "secondary_evaluation_summary_test.csv"), index=False
    )

    # Save test predictions
    save_predictions(
        meta_df=meta_test,
        probs=test_probs,
        hybrid_score_raw=hybrid_test_raw,
        hybrid_score_cal=hybrid_test_cal,
        hybrid_pred=hybrid_test_pred,
        triage_levels=triage_test,
        split="test",
    )
    plot_triage_distribution(triage_test, y_test, split="Test")

    # ----------------------------------------------------------
    # Feature importance + traffic patterns
    # ----------------------------------------------------------
    df_imp    = analyse_feature_importance(models["rf_model"], FEATURE_COLS)
    df_stats  = analyse_traffic_patterns(X_train, y_train, FEATURE_COLS, top_n=8)

    # ----------------------------------------------------------
    # Save config JSON (includes all actual results)
    # ----------------------------------------------------------
    elapsed = round(time.time() - run_start, 1)
    save_config(
        hybrid_cfg=hybrid_cfg,
        feature_names=FEATURE_COLS,
        n_train=len(y_train),
        n_val=len(y_val),
        n_test=len(y_test),
        val_summary=val_summary,
        test_summary=test_summary,
        elapsed=elapsed,
    )

    # ----------------------------------------------------------
    # Final summary
    # ----------------------------------------------------------
    banner("PIPELINE COMPLETE")
    print(f"\n  Runtime : {elapsed:.1f} s")
    print(f"\n  {'Model':<22s}  {'Split':<5}  "
          f"{'Accuracy':>8}  {'Precision':>9}  {'Recall':>7}  {'F1':>7}  {'AUC':>7}  {'FN':>5}")
    print("  " + "-" * 80)
    for df in [val_summary, test_summary]:
        for _, row in df.iterrows():
            print(f"  {row['model']:<22s}  {row['split']:<5}  "
                  f"{row['accuracy']:>8.4f}  {row['precision']:>9.4f}  "
                  f"{row['recall']:>7.4f}  {row['f1']:>7.4f}  "
                  f"{row['roc_auc']:>7.4f}  {row['FN']:>5d}")

    print(f"\n  SOC Triage on Test Set:")
    for lvl in [TRIAGE_LOW, TRIAGE_REVIEW, TRIAGE_HIGH]:
        cnt = int((triage_test == lvl).sum())
        print(f"    {lvl:<20s}: {cnt:>5d}")

    print(f"\n  All results saved to: {OUT_ROOT}")
    print()


if __name__ == "__main__":
    main()
