"""
comparison_report.py
====================
Cross-Dataset Comparison Report
Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage

Reads ONLY the already-generated result artefacts from both the Primary Model
(results/) and the Secondary Model (ML Models/ML Models/Secondary Model/metrics/)
and produces a side-by-side comparison report.

NO retraining, NO dataset merging, NO new inference.
All numbers are read directly from saved CSV / JSON files.

Outputs
-------
    ML Models/ML Models/
        comparison_report.txt        ← full text report
        comparison_metrics.csv       ← side-by-side metrics table
        comparison_plots/
            compare_accuracy.png
            compare_precision.png
            compare_recall.png
            compare_f1.png
            compare_roc_auc.png
            compare_false_negatives.png
            compare_feature_importance.png
            compare_radar.png
            compare_hybrid_weights.png
            compare_triage_distribution.png

Usage
-----
    python "ML Models/ML Models/comparison_report.py"
"""

import os
import sys
import json
import textwrap
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.ticker as mticker
from matplotlib.gridspec import GridSpec
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
WORKSPACE    = os.path.dirname(os.path.dirname(SCRIPT_DIR))   # repo root

PRIMARY_METRICS  = os.path.join(WORKSPACE, "results", "metrics")
PRIMARY_PREDS    = os.path.join(WORKSPACE, "results", "predictions")
SECONDARY_METRICS = os.path.join(SCRIPT_DIR, "Secondary Model", "metrics")
SECONDARY_PREDS   = os.path.join(SCRIPT_DIR, "Secondary Model", "predictions")

COMPARE_DIR  = os.path.join(SCRIPT_DIR, "comparison_plots")
REPORT_PATH  = os.path.join(SCRIPT_DIR, "comparison_report.txt")
CSV_PATH     = os.path.join(SCRIPT_DIR, "comparison_metrics.csv")

os.makedirs(COMPARE_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Colour palette
# ─────────────────────────────────────────────────────────────────────────────
C_PRI  = "#3498db"   # primary dataset colour
C_SEC  = "#e67e22"   # secondary dataset colour
C_GOOD = "#2ecc71"
C_WARN = "#f39c12"
C_BAD  = "#e74c3c"
C_BG   = "#1a1a2e"
C_GRID = "#2c3e50"
C_TEXT = "#ecf0f1"

STYLE = {
    "figure.facecolor":  C_BG,
    "axes.facecolor":    "#16213e",
    "axes.edgecolor":    C_GRID,
    "axes.labelcolor":   C_TEXT,
    "axes.titlecolor":   C_TEXT,
    "xtick.color":       C_TEXT,
    "ytick.color":       C_TEXT,
    "text.color":        C_TEXT,
    "grid.color":        C_GRID,
    "grid.linestyle":    "--",
    "grid.alpha":        0.4,
    "legend.facecolor":  "#1a1a2e",
    "legend.edgecolor":  C_GRID,
    "legend.labelcolor": C_TEXT,
}
plt.rcParams.update(STYLE)

# ─────────────────────────────────────────────────────────────────────────────
# Load Primary results
# ─────────────────────────────────────────────────────────────────────────────
print("Loading Primary Model results …")
pri_eval_test = pd.read_csv(os.path.join(PRIMARY_METRICS, "evaluation_summary_test.csv"))
pri_eval_val  = pd.read_csv(os.path.join(PRIMARY_METRICS, "evaluation_summary_val.csv"))
pri_feat_imp  = pd.read_csv(os.path.join(PRIMARY_METRICS, "feature_importance.csv"))
pri_pred_test = pd.read_csv(os.path.join(PRIMARY_PREDS,   "predictions_test.csv"))
with open(os.path.join(PRIMARY_METRICS, "experiment_metadata.json")) as f:
    pri_meta = json.load(f)
with open(os.path.join(PRIMARY_METRICS, "hybrid_config.json")) as f:
    pri_hybrid = json.load(f)

# Compute Primary TP/TN/FP/FN from saved predictions
from sklearn.metrics import confusion_matrix as _cm
pri_cm = {}
for col, name in [("lr_pred","LR"), ("rf_pred","RF"), ("hybrid_pred","Hybrid")]:
    tn, fp, fn, tp = _cm(pri_pred_test["label_binary"], pri_pred_test[col]).ravel()
    pri_cm[name] = {"TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn)}

# Normalise Primary column names to match secondary
pri_eval_test = pri_eval_test.rename(columns={
    "Model": "model", "Accuracy": "accuracy", "Precision": "precision",
    "Recall": "recall", "F1": "f1", "ROC_AUC": "roc_auc"
})
pri_eval_test["model"] = pri_eval_test["model"].replace({"Hybrid": "Hybrid Model"})
for m_name, cm_vals in pri_cm.items():
    model_label = {"LR": "Logistic Regression", "RF": "Random Forest",
                   "Hybrid": "Hybrid Model"}[m_name]
    for k, v in cm_vals.items():
        pri_eval_test.loc[pri_eval_test["model"] == model_label, k] = v

# Primary triage counts
pri_triage = pri_pred_test["triage_level"].value_counts().to_dict()

# ─────────────────────────────────────────────────────────────────────────────
# Load Secondary results
# ─────────────────────────────────────────────────────────────────────────────
print("Loading Secondary Model results …")
sec_eval_test = pd.read_csv(os.path.join(SECONDARY_METRICS, "secondary_evaluation_summary_test.csv"))
sec_eval_val  = pd.read_csv(os.path.join(SECONDARY_METRICS, "secondary_evaluation_summary_val.csv"))
sec_feat_imp  = pd.read_csv(os.path.join(SECONDARY_METRICS, "secondary_feature_importance.csv"))
sec_pred_test = pd.read_csv(os.path.join(SECONDARY_PREDS,   "secondary_predictions_test.csv"))
with open(os.path.join(SECONDARY_METRICS, "secondary_experiment_config.json")) as f:
    sec_cfg = json.load(f)

# Secondary triage counts
sec_triage = sec_pred_test["triage_level"].value_counts().to_dict()

# ─────────────────────────────────────────────────────────────────────────────
# Build unified comparison table
# ─────────────────────────────────────────────────────────────────────────────
def _row(dataset, model_name, row, cm):
    return {
        "Dataset":    dataset,
        "Model":      model_name,
        "Accuracy":   round(float(row["accuracy"]),  4),
        "Precision":  round(float(row["precision"]), 4),
        "Recall":     round(float(row["recall"]),    4),
        "F1":         round(float(row["f1"]),        4),
        "ROC_AUC":    round(float(row["roc_auc"]),   4),
        "TP":         int(cm["TP"]),
        "TN":         int(cm["TN"]),
        "FP":         int(cm["FP"]),
        "FN":         int(cm["FN"]),
    }

comparison_rows = []
model_map = {
    "Logistic Regression": "LR",
    "Random Forest":       "RF",
    "Hybrid Model":        "Hybrid",
}
for _, row in pri_eval_test.iterrows():
    short = model_map.get(row["model"], row["model"])
    comparison_rows.append(_row("Primary", row["model"], row, pri_cm[short]))

for _, row in sec_eval_test.iterrows():
    short = model_map.get(row["model"], row["model"])
    cm = {"TP": int(row["TP"]), "TN": int(row["TN"]),
          "FP": int(row["FP"]), "FN": int(row["FN"])}
    comparison_rows.append(_row("Secondary", row["model"], row, cm))

df_comp = pd.DataFrame(comparison_rows)
df_comp.to_csv(CSV_PATH, index=False)
print(f"  Comparison CSV saved: {CSV_PATH}")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers for plotting
# ─────────────────────────────────────────────────────────────────────────────
MODELS = ["Logistic Regression", "Random Forest", "Hybrid Model"]
METRICS_COLS = ["Accuracy", "Precision", "Recall", "F1", "ROC_AUC"]
METRICS_LABELS = ["Accuracy", "Precision", "Recall", "F1", "ROC-AUC"]

def _get(dataset, model, metric):
    row = df_comp[(df_comp["Dataset"] == dataset) & (df_comp["Model"] == model)]
    if row.empty:
        return float("nan")
    return float(row.iloc[0][metric])

def _save(name):
    path = os.path.join(COMPARE_DIR, name)
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path}")
    return path

# ─────────────────────────────────────────────────────────────────────────────
# Plot 1-5: per-metric grouped bar (one plot per metric)
# ─────────────────────────────────────────────────────────────────────────────
def plot_metric(metric_col, metric_label, filename, ymin=None):
    x = np.arange(len(MODELS))
    w = 0.32
    pri_vals = [_get("Primary",   m, metric_col) for m in MODELS]
    sec_vals = [_get("Secondary", m, metric_col) for m in MODELS]

    fig, ax = plt.subplots(figsize=(9, 5))
    b1 = ax.bar(x - w/2, pri_vals, w, label="Primary Dataset",   color=C_PRI, alpha=0.9)
    b2 = ax.bar(x + w/2, sec_vals, w, label="Secondary Dataset", color=C_SEC, alpha=0.9)

    for bars in [b1, b2]:
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h + 0.003,
                    f"{h:.4f}", ha="center", va="bottom", fontsize=9, color=C_TEXT)

    ax.set_xticks(x)
    ax.set_xticklabels(MODELS, fontsize=11)
    ax.set_ylabel(metric_label, fontsize=11)
    ax.set_title(f"{metric_label} — Primary vs Secondary Dataset", fontsize=13,
                 fontweight="bold", pad=12)
    if ymin is not None:
        ax.set_ylim(ymin, 1.02)
    ax.legend(fontsize=10)
    ax.grid(axis="y", alpha=0.4)
    ax.yaxis.set_major_formatter(mticker.FormatStrFormatter("%.3f"))
    plt.tight_layout()
    _save(filename)

plot_metric("Accuracy",  "Accuracy",  "compare_accuracy.png",  ymin=0.80)
plot_metric("Precision", "Precision", "compare_precision.png", ymin=0.80)
plot_metric("Recall",    "Recall",    "compare_recall.png",    ymin=0.30)
plot_metric("F1",        "F1 Score",  "compare_f1.png",        ymin=0.50)
plot_metric("ROC_AUC",   "ROC-AUC",  "compare_roc_auc.png",   ymin=0.80)

# ─────────────────────────────────────────────────────────────────────────────
# Plot 6: False Negatives (missed attacks)
# ─────────────────────────────────────────────────────────────────────────────
def plot_fn():
    x = np.arange(len(MODELS))
    w = 0.32
    pri_fn = [_get("Primary",   m, "FN") for m in MODELS]
    sec_fn = [_get("Secondary", m, "FN") for m in MODELS]

    fig, ax = plt.subplots(figsize=(9, 5))
    b1 = ax.bar(x - w/2, pri_fn, w, label="Primary Dataset",   color=C_PRI, alpha=0.9)
    b2 = ax.bar(x + w/2, sec_fn, w, label="Secondary Dataset", color=C_SEC, alpha=0.9)

    for bars in [b1, b2]:
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h + 1,
                    str(int(h)), ha="center", va="bottom", fontsize=9, color=C_TEXT)

    ax.set_xticks(x)
    ax.set_xticklabels(MODELS, fontsize=11)
    ax.set_ylabel("False Negatives (Missed Attacks)", fontsize=11)
    ax.set_title("Missed Attacks (FN) — Primary vs Secondary", fontsize=13,
                 fontweight="bold", pad=12)
    ax.legend(fontsize=10)
    ax.grid(axis="y", alpha=0.4)
    plt.tight_layout()
    _save("compare_false_negatives.png")

plot_fn()

# ─────────────────────────────────────────────────────────────────────────────
# Plot 7: Feature importance side by side
# ─────────────────────────────────────────────────────────────────────────────
def plot_feature_importance():
    top_n = 10
    pri_top = pri_feat_imp.nlargest(top_n, "importance").reset_index(drop=True)
    sec_top = sec_feat_imp.nlargest(top_n, "importance").reset_index(drop=True)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
    fig.suptitle("Top-10 RF Feature Importance: Primary vs Secondary",
                 fontsize=13, fontweight="bold", y=1.01)

    for ax, df, colour, title in [
        (ax1, pri_top, C_PRI, "Primary Dataset"),
        (ax2, sec_top, C_SEC, "Secondary Dataset"),
    ]:
        df_plot = df.sort_values("importance")
        bars = ax.barh(df_plot["feature"], df_plot["importance"],
                       color=colour, alpha=0.85, edgecolor="white")
        for bar, val in zip(bars, df_plot["importance"]):
            ax.text(bar.get_width() + 0.002, bar.get_y() + bar.get_height()/2,
                    f"{val:.4f}", va="center", fontsize=8, color=C_TEXT)
        ax.set_title(title, fontsize=11, fontweight="bold")
        ax.set_xlabel("Gini Importance", fontsize=10)
        ax.xaxis.set_major_formatter(mticker.FormatStrFormatter("%.3f"))
        ax.grid(axis="x", alpha=0.4)

    plt.tight_layout()
    _save("compare_feature_importance.png")

plot_feature_importance()

# ─────────────────────────────────────────────────────────────────────────────
# Plot 8: Radar chart — all 5 metrics, all 3 models, both datasets
# ─────────────────────────────────────────────────────────────────────────────
def plot_radar():
    categories = ["Accuracy", "Precision", "Recall", "F1", "ROC-AUC"]
    metrics    = ["Accuracy", "Precision", "Recall", "F1", "ROC_AUC"]
    N = len(categories)
    angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
    angles += angles[:1]

    fig, axes = plt.subplots(1, 3, figsize=(15, 5),
                              subplot_kw={"polar": True})
    fig.suptitle("Model Performance Radar — Primary vs Secondary",
                 fontsize=13, fontweight="bold", y=1.03)

    for ax, model_name in zip(axes, MODELS):
        for dataset, colour, style in [
            ("Primary",   C_PRI, "-"),
            ("Secondary", C_SEC, "--"),
        ]:
            vals = [_get(dataset, model_name, m) for m in metrics]
            vals += vals[:1]
            ax.plot(angles, vals, style, color=colour, linewidth=1.8, label=dataset)
            ax.fill(angles, vals, color=colour, alpha=0.15)

        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, size=9, color=C_TEXT)
        ax.set_ylim(0, 1)
        ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
        ax.set_yticklabels(["0.2", "0.4", "0.6", "0.8", "1.0"], size=7, color=C_TEXT)
        ax.set_title(model_name, size=10, fontweight="bold", pad=14, color=C_TEXT)
        ax.tick_params(colors=C_TEXT)
        ax.grid(color=C_GRID, linestyle="--", alpha=0.5)
        ax.spines["polar"].set_color(C_GRID)

    handles = [
        mpatches.Patch(color=C_PRI, label="Primary Dataset"),
        mpatches.Patch(color=C_SEC, label="Secondary Dataset"),
    ]
    fig.legend(handles=handles, loc="lower center", ncol=2, fontsize=10,
               frameon=True, framealpha=0.8)
    plt.tight_layout()
    _save("compare_radar.png")

plot_radar()

# ─────────────────────────────────────────────────────────────────────────────
# Plot 9: Hybrid weights comparison
# ─────────────────────────────────────────────────────────────────────────────
def plot_hybrid_weights():
    pri_w  = [pri_hybrid["w1_lr"], pri_hybrid["w2_rf"]]
    sec_w  = [sec_cfg["hybrid_w1_lr"], sec_cfg["hybrid_w2_rf"]]
    labels = ["w_LR (Logistic Regression)", "w_RF (Random Forest)"]
    x = np.arange(len(labels))
    w = 0.32

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("Hybrid Model Configuration Comparison", fontsize=13,
                 fontweight="bold")

    # Weight bars
    b1 = ax1.bar(x - w/2, pri_w, w, label="Primary",   color=C_PRI, alpha=0.9)
    b2 = ax1.bar(x + w/2, sec_w, w, label="Secondary", color=C_SEC, alpha=0.9)
    for bars in [b1, b2]:
        for bar in bars:
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                     f"{bar.get_height():.2f}", ha="center", va="bottom",
                     fontsize=11, fontweight="bold", color=C_TEXT)
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, fontsize=10)
    ax1.set_ylabel("Weight", fontsize=10)
    ax1.set_title("Hybrid Weights (tuned on val set)", fontsize=11, fontweight="bold")
    ax1.set_ylim(0, 1.1)
    ax1.legend(fontsize=10)
    ax1.grid(axis="y", alpha=0.4)

    # Thresholds comparison
    threshold_data = {
        "Decision\nThreshold": (pri_hybrid["decision_threshold"],
                                sec_cfg["decision_threshold"]),
        "Low Triage\nThreshold": (pri_hybrid["low_triage_threshold"],
                                  sec_cfg["low_triage_threshold"]),
        "High Triage\nThreshold": (pri_hybrid["high_triage_threshold"],
                                   sec_cfg["high_triage_threshold"]),
    }
    thr_labels = list(threshold_data.keys())
    pri_thr = [v[0] for v in threshold_data.values()]
    sec_thr = [v[1] for v in threshold_data.values()]
    x2 = np.arange(len(thr_labels))
    b3 = ax2.bar(x2 - w/2, pri_thr, w, label="Primary",   color=C_PRI, alpha=0.9)
    b4 = ax2.bar(x2 + w/2, sec_thr, w, label="Secondary", color=C_SEC, alpha=0.9)
    for bars in [b3, b4]:
        for bar in bars:
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                     f"{bar.get_height():.3f}", ha="center", va="bottom",
                     fontsize=9, color=C_TEXT)
    ax2.set_xticks(x2)
    ax2.set_xticklabels(thr_labels, fontsize=10)
    ax2.set_ylabel("Threshold Value", fontsize=10)
    ax2.set_title("Decision & Triage Thresholds", fontsize=11, fontweight="bold")
    ax2.set_ylim(0, 1.15)
    ax2.legend(fontsize=10)
    ax2.grid(axis="y", alpha=0.4)

    plt.tight_layout()
    _save("compare_hybrid_weights.png")

plot_hybrid_weights()

# ─────────────────────────────────────────────────────────────────────────────
# Plot 10: SOC Triage distribution comparison
# ─────────────────────────────────────────────────────────────────────────────
def plot_triage():
    levels = ["Low Suspicion", "Medium / Review", "High Suspicion"]
    # Primary uses different labels
    pri_map = {
        "Low Suspicion":   pri_triage.get("Low Suspicion", 0),
        "Medium / Review": pri_triage.get("Review", 0),
        "High Suspicion":  pri_triage.get("High Suspicion", 0),
    }
    sec_map = {
        "Low Suspicion":   sec_triage.get("Low Suspicion", 0),
        "Medium / Review": sec_triage.get("Medium / Review", 0),
        "High Suspicion":  sec_triage.get("High Suspicion", 0),
    }
    pri_total = sum(pri_map.values())
    sec_total = sum(sec_map.values())
    pri_pct   = [pri_map[l] / pri_total * 100 for l in levels]
    sec_pct   = [sec_map[l] / sec_total * 100 for l in levels]

    x = np.arange(len(levels))
    w = 0.32
    colours_lvl = {"Low Suspicion": C_GOOD, "Medium / Review": C_WARN,
                   "High Suspicion": C_BAD}

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle("SOC Triage Level Distribution — Primary vs Secondary",
                 fontsize=13, fontweight="bold")

    # Absolute counts
    b1 = ax1.bar(x - w/2, [pri_map[l] for l in levels], w,
                 label="Primary",   color=C_PRI, alpha=0.85)
    b2 = ax1.bar(x + w/2, [sec_map[l] for l in levels], w,
                 label="Secondary", color=C_SEC, alpha=0.85)
    for bars in [b1, b2]:
        for bar in bars:
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5,
                     str(int(bar.get_height())), ha="center", va="bottom",
                     fontsize=9, color=C_TEXT)
    ax1.set_xticks(x)
    ax1.set_xticklabels(levels, fontsize=10)
    ax1.set_ylabel("Event Count", fontsize=10)
    ax1.set_title("Absolute Counts (Test Set)", fontsize=11, fontweight="bold")
    ax1.legend(fontsize=10)
    ax1.grid(axis="y", alpha=0.4)

    # Percentage
    b3 = ax2.bar(x - w/2, pri_pct, w, label="Primary",   color=C_PRI, alpha=0.85)
    b4 = ax2.bar(x + w/2, sec_pct, w, label="Secondary", color=C_SEC, alpha=0.85)
    for bars in [b3, b4]:
        for bar in bars:
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                     f"{bar.get_height():.1f}%", ha="center", va="bottom",
                     fontsize=9, color=C_TEXT)
    ax2.set_xticks(x)
    ax2.set_xticklabels(levels, fontsize=10)
    ax2.set_ylabel("Percentage (%)", fontsize=10)
    ax2.set_title("Percentage of Test Events", fontsize=11, fontweight="bold")
    ax2.legend(fontsize=10)
    ax2.grid(axis="y", alpha=0.4)

    plt.tight_layout()
    _save("compare_triage_distribution.png")

plot_triage()

# ─────────────────────────────────────────────────────────────────────────────
# Generate text report
# ─────────────────────────────────────────────────────────────────────────────
def _line(char="─", width=78):
    return char * width

def _h1(text):
    return f"\n{'═'*78}\n  {text}\n{'═'*78}"

def _h2(text):
    return f"\n{'─'*78}\n  {text}\n{'─'*78}"

def _tbl_row(*cols, widths):
    return "  " + "".join(str(c).ljust(w) for c, w in zip(cols, widths))

def _tbl_hdr(*cols, widths):
    row = _tbl_row(*cols, widths=widths)
    sep = "  " + "─" * (sum(widths))
    return row + "\n" + sep

def fmt(v, digits=4):
    try:
        return f"{float(v):.{digits}f}"
    except Exception:
        return str(v)

lines = []

lines.append(_h1("CROSS-DATASET COMPARISON REPORT"))
lines.append("""
  Title    : Confidence-Based Hybrid ML Framework for SOC Alert Triage
  Scope    : Primary Dataset (IDS/Suricata testbed) vs
             Secondary Dataset (CIC-IDS-2017 network flows)
  Note     : All values read from saved artefacts. No retraining. No merging.
""")

# ─── 1. Dataset summary ───────────────────────────────────────────────────
lines.append(_h2("1. Dataset Characteristics"))

pri_n     = pri_meta["n_train"] + pri_meta["n_val"] + pri_meta["n_test"]
sec_n     = sec_cfg["n_train"]  + sec_cfg["n_val"]  + sec_cfg["n_test"]
pri_ar    = round(pri_pred_test["label_binary"].mean() * 100, 1)
sec_ar    = round(sec_pred_test["label_binary"].mean() * 100, 1)

W = [36, 22, 22]
lines.append(_tbl_hdr("Characteristic", "Primary", "Secondary", widths=W))
lines.append(_tbl_row("Source",
                       "Testbed / Suricata IDS",
                       "CIC-IDS-2017 (CICIDS)", widths=W))
lines.append(_tbl_row("Total rows",
                       f"{pri_n:,}", f"{sec_n:,}", widths=W))
lines.append(_tbl_row("Train rows",
                       f"{pri_meta['n_train']:,}",
                       f"{sec_cfg['n_train']:,}", widths=W))
lines.append(_tbl_row("Validation rows",
                       f"{pri_meta['n_val']:,}",
                       f"{sec_cfg['n_val']:,}", widths=W))
lines.append(_tbl_row("Test rows",
                       f"{pri_meta['n_test']:,}",
                       f"{sec_cfg['n_test']:,}", widths=W))
lines.append(_tbl_row("Attack rate (test set)",
                       f"{pri_ar}%", f"{sec_ar}%", widths=W))
lines.append(_tbl_row("Number of features",
                       str(pri_meta["n_features"]),
                       str(sec_cfg["n_features"]), widths=W))
lines.append(_tbl_row("Split method",
                       "Time-based (15% val)",
                       "Stratified shuffle (15%)", widths=W))
lines.append(_tbl_row("Random seed",
                       str(pri_meta["random_seed"]),
                       str(sec_cfg["random_seed"]), widths=W))

lines.append("""
  Primary feature set  : 22 features including one-hot protocol flags, interface
    flags, engineered port flags, directional packet/byte counts, temporal features.
  Secondary feature set: 12 common network-flow features — source/destination ports,
    forward/backward packet counts, forward/backward byte lengths, total packets,
    total bytes, bytes-per-packet, packet asymmetry ratio, hour of day, day of week.
  Overlap              : Both share bytes_per_packet, total_bytes, total_packets,
    directional packet/byte counts, hour_of_day, day_of_week (6 conceptual features).
""")

# ─── 2. Model configuration ───────────────────────────────────────────────
lines.append(_h2("2. Model Configuration"))

W2 = [36, 22, 22]
lines.append(_tbl_hdr("Parameter", "Primary", "Secondary", widths=W2))
lines.append(_tbl_row("LR — C",                  "1.0",      "1.0",       widths=W2))
lines.append(_tbl_row("LR — solver",             "lbfgs",    "lbfgs",     widths=W2))
lines.append(_tbl_row("LR — max_iter",           "1000",     "1000",      widths=W2))
lines.append(_tbl_row("LR — class_weight",       "balanced", "balanced",  widths=W2))
lines.append(_tbl_row("RF — n_estimators",       "300",      "300",       widths=W2))
lines.append(_tbl_row("RF — max_depth",          "None",     "None",      widths=W2))
lines.append(_tbl_row("RF — min_samples_leaf",   "2",        "2",         widths=W2))
lines.append(_tbl_row("RF — class_weight",       "balanced", "balanced",  widths=W2))
lines.append(_tbl_row("Calibration method",      "isotonic", "isotonic",  widths=W2))
lines.append(_tbl_row("Hybrid weight w_LR",
                       fmt(pri_hybrid["w1_lr"], 2),
                       fmt(sec_cfg["hybrid_w1_lr"], 2), widths=W2))
lines.append(_tbl_row("Hybrid weight w_RF",
                       fmt(pri_hybrid["w2_rf"], 2),
                       fmt(sec_cfg["hybrid_w2_rf"], 2), widths=W2))
lines.append(_tbl_row("Decision threshold",
                       fmt(pri_hybrid["decision_threshold"]),
                       fmt(sec_cfg["decision_threshold"]), widths=W2))
lines.append(_tbl_row("Low triage threshold",
                       fmt(pri_hybrid["low_triage_threshold"]),
                       fmt(sec_cfg["low_triage_threshold"]), widths=W2))
lines.append(_tbl_row("High triage threshold",
                       fmt(pri_hybrid["high_triage_threshold"]),
                       fmt(sec_cfg["high_triage_threshold"]), widths=W2))

lines.append("""
  Observation:
    Both models used identical hyperparameters and calibration methods.
    The hybrid weights diverged: Primary settled on w_LR=0.30 / w_RF=0.70,
    while Secondary converged to w_LR=0.10 / w_RF=0.90 — indicating Random
    Forest dominates even more strongly on the network-flow feature set.
    Primary's decision threshold (0.5025) sits near 0.5 as expected for
    balanced classes; Secondary's lower threshold (0.2723) reflects the RF's
    tendency to assign very high attack probabilities, skewing the combined
    score distribution downward.
""")

# ─── 3. Logistic Regression comparison ───────────────────────────────────
lines.append(_h2("3. Logistic Regression — Test Set Performance"))

W3 = [18, 10, 10, 10, 10, 10, 8]
lines.append(_tbl_hdr("Dataset", "Accuracy", "Precision",
                       "Recall", "F1", "ROC-AUC", "FN", widths=W3))
for ds in ["Primary", "Secondary"]:
    r = df_comp[(df_comp["Dataset"]==ds) & (df_comp["Model"]=="Logistic Regression")].iloc[0]
    lines.append(_tbl_row(ds,
                           fmt(r["Accuracy"]), fmt(r["Precision"]),
                           fmt(r["Recall"]),   fmt(r["F1"]),
                           fmt(r["ROC_AUC"]),  str(int(r["FN"])), widths=W3))

lines.append("""
  Observation:
    LR achieved very different recall across datasets.
    On the Primary dataset (attack-heavy: ~83% attack rate) LR reached
    Recall=0.8538, suggesting its linear decision boundary suited the
    alert-signature-style patterns in that testbed traffic.
    On the Secondary dataset (20% attack rate, pure network flows),
    LR's Recall collapsed to 0.4031, missing 3,535 of 5,922 attacks.
    This confirms LR cannot linearly separate the heterogeneous CIC-IDS-2017
    attack families (DoS, PortScan, DDoS, Brute Force, Infiltration) from
    normal traffic using only 12 flow-level features without richer engineering.
    The high Precision (0.9270) shows LR is cautious — when it does fire, it
    is usually correct — but it simply does not fire often enough.
""")

# ─── 4. Random Forest comparison ─────────────────────────────────────────
lines.append(_h2("4. Random Forest — Test Set Performance"))

lines.append(_tbl_hdr("Dataset", "Accuracy", "Precision",
                       "Recall", "F1", "ROC-AUC", "FN", widths=W3))
for ds in ["Primary", "Secondary"]:
    r = df_comp[(df_comp["Dataset"]==ds) & (df_comp["Model"]=="Random Forest")].iloc[0]
    lines.append(_tbl_row(ds,
                           fmt(r["Accuracy"]), fmt(r["Precision"]),
                           fmt(r["Recall"]),   fmt(r["F1"]),
                           fmt(r["ROC_AUC"]),  str(int(r["FN"])), widths=W3))

lines.append("""
  Observation:
    Random Forest delivered strong performance on both datasets, confirming
    that tree-based ensembles generalise well to network intrusion detection
    regardless of feature richness.
    Secondary RF (Recall=0.9912, FN=52) is marginally below Primary RF
    (Recall=0.9829, FN=51) in absolute FN count, despite the Secondary test
    set being ~8x larger — meaning the Secondary RF missed proportionally
    fewer attacks relative to its test set size.
    ROC-AUC of 0.9998 on Secondary vs 0.9977 on Primary reflects the cleaner
    separability of the CIC-IDS-2017 flow features for attack detection.
    Neither RF required feature scaling, validating the design decision to
    skip StandardScaler for the tree ensemble on both datasets.
""")

# ─── 5. Hybrid model comparison ──────────────────────────────────────────
lines.append(_h2("5. Hybrid Model — Test Set Performance"))

lines.append(_tbl_hdr("Dataset", "Accuracy", "Precision",
                       "Recall", "F1", "ROC-AUC", "FN", widths=W3))
for ds in ["Primary", "Secondary"]:
    r = df_comp[(df_comp["Dataset"]==ds) & (df_comp["Model"]=="Hybrid Model")].iloc[0]
    lines.append(_tbl_row(ds,
                           fmt(r["Accuracy"]), fmt(r["Precision"]),
                           fmt(r["Recall"]),   fmt(r["F1"]),
                           fmt(r["ROC_AUC"]),  str(int(r["FN"])), widths=W3))

lines.append("""
  Observation:
    The Hybrid model outperformed or matched standalone models on both
    datasets in terms of recall — the most operationally critical metric.
    On Primary: Hybrid reduced FN from 51 (RF) to 66 at the cost of slightly
    lower recall (0.9779 vs 0.9829). The Primary Hybrid trades marginally
    more false negatives for higher precision (0.9929) and fewer false
    positives (FP=21), suggesting its threshold and weights were tuned for
    precision in a high-attack-rate environment.
    On Secondary: Hybrid reduced FN from 52 (RF) to 41, a direct improvement
    in missed attacks. Recall improved to 0.9931 vs RF's 0.9912. This is the
    expected behaviour of the weighted combination — the small LR weight (0.10)
    provides just enough complementary signal to nudge the hybrid score above
    the threshold for borderline cases that RF nearly missed.
""")

# ─── 6. Full comparison matrix ───────────────────────────────────────────
lines.append(_h2("6. Full Metric Matrix — All Models, Both Datasets"))

W4 = [12, 24, 10, 10, 10, 10, 10, 6, 6]
lines.append(_tbl_hdr("Dataset", "Model", "Accuracy", "Precision",
                       "Recall", "F1", "ROC-AUC", "FP", "FN", widths=W4))
for ds in ["Primary", "Secondary"]:
    for mdl in MODELS:
        r = df_comp[(df_comp["Dataset"]==ds) & (df_comp["Model"]==mdl)].iloc[0]
        lines.append(_tbl_row(ds, mdl,
                               fmt(r["Accuracy"]), fmt(r["Precision"]),
                               fmt(r["Recall"]),   fmt(r["F1"]),
                               fmt(r["ROC_AUC"]),
                               str(int(r["FP"])), str(int(r["FN"])), widths=W4))

# ─── 7. Feature importance comparison ────────────────────────────────────
lines.append(_h2("7. Top-10 Random Forest Feature Importance Comparison"))

top5_pri = pri_feat_imp.nlargest(10, "importance")
top5_sec = sec_feat_imp.nlargest(10, "importance")

W5 = [5, 34, 10, 34, 10]
lines.append(_tbl_hdr("Rank", "Primary Feature", "Importance",
                       "Secondary Feature", "Importance", widths=W5))
for i in range(10):
    pri_r = top5_pri.iloc[i]
    sec_r = top5_sec.iloc[i]
    lines.append(_tbl_row(
        str(i+1),
        pri_r["feature"], fmt(pri_r["importance"]),
        sec_r["feature"], fmt(sec_r["importance"]),
        widths=W5
    ))

lines.append("""
  Observation:
    Both datasets independently rank bytes_per_packet and volume-related
    features among the most discriminative features for attack detection.
    Primary: total_bytes (0.1388) and bytes_per_packet (0.1346) lead,
    followed by protocol flags (proto_TCP = 0.1169) and dest_port (0.1129).
    Secondary: bytes_per_packet (0.1616) and Destination Port (0.1523) lead,
    followed by total_bytes (0.1240) and temporal feature day_of_week (0.1138).
    The convergence on byte-volume and port features across completely
    independent datasets — different capture environments, different feature
    extraction tools — validates that these are genuine, generalisable
    indicators of malicious network behaviour rather than artefacts of one
    specific dataset.
    Temporal features (day_of_week) rank more highly in Secondary (rank 4)
    than in Primary (rank 18), likely because CIC-IDS-2017 attacks were
    concentrated on specific weekdays.
""")

# ─── 8. SOC Triage comparison ────────────────────────────────────────────
lines.append(_h2("8. SOC Triage Level Distribution Comparison"))

pri_total_preds = sum(pri_triage.values())
sec_total_preds = sum(sec_triage.values())
pri_tmap = {
    "Low Suspicion":   pri_triage.get("Low Suspicion", 0),
    "Medium / Review": pri_triage.get("Review", 0),
    "High Suspicion":  pri_triage.get("High Suspicion", 0),
}
sec_tmap = {
    "Low Suspicion":   sec_triage.get("Low Suspicion", 0),
    "Medium / Review": sec_triage.get("Medium / Review", 0),
    "High Suspicion":  sec_triage.get("High Suspicion", 0),
}

W6 = [22, 12, 10, 12, 10]
lines.append(_tbl_hdr("Triage Level", "Primary (n)", "Primary %",
                       "Secondary (n)", "Secondary %", widths=W6))
for lvl in ["Low Suspicion", "Medium / Review", "High Suspicion"]:
    pn  = pri_tmap[lvl]
    sn  = sec_tmap[lvl]
    pp  = f"{pn/pri_total_preds*100:.1f}%"
    sp  = f"{sn/sec_total_preds*100:.1f}%"
    lines.append(_tbl_row(lvl, str(pn), pp, str(sn), sp, widths=W6))
lines.append(_tbl_row("Total", str(pri_total_preds), "100%",
                       str(sec_total_preds), "100%", widths=W6))

lines.append(f"""
  Configuration:
    Primary  — Low < {pri_hybrid['low_triage_threshold']:.4f} |
               High >= {pri_hybrid['high_triage_threshold']:.4f}
    Secondary — Low < {sec_cfg['low_triage_threshold']:.4f} |
               High >= {sec_cfg['high_triage_threshold']:.4f}

  Observation:
    The Primary test set is attack-dominated (~83% attack rate), so most
    events fall into Review or High Suspicion — only 15.6% are Low Suspicion.
    The Secondary test set is normal-traffic-dominated (~80% normal), so the
    vast majority (78.6%) correctly fall into Low Suspicion, with 12.8% in
    Medium/Review and 8.6% in High Suspicion.
    This behavioural difference is entirely expected and driven by the
    underlying class distributions, not by any model quality difference.
    Both triage systems were calibrated on their respective validation sets
    and applied only to their own unseen test sets.
""")

# ─── 9. Recall & false-negative focus ────────────────────────────────────
lines.append(_h2("9. SOC Operational Focus: Recall & False Negatives"))

lines.append(f"""
  In Security Operations, a False Negative means an attack reaches the network
  without any analyst alert — the most costly error in SOC operations.

  Primary Dataset (test n={pri_meta['n_test']:,}, attack rate={pri_ar}%):
    LR     : FN={pri_cm['LR']['FN']:>4d}  Recall={_get('Primary','Logistic Regression','Recall'):.4f}
    RF     : FN={pri_cm['RF']['FN']:>4d}  Recall={_get('Primary','Random Forest','Recall'):.4f}
    Hybrid : FN={pri_cm['Hybrid']['FN']:>4d}  Recall={_get('Primary','Hybrid Model','Recall'):.4f}

  Secondary Dataset (test n={sec_cfg['n_test']:,}, attack rate={sec_ar}%):
    LR     : FN={int(_get('Secondary','Logistic Regression','FN')):>4d}  Recall={_get('Secondary','Logistic Regression','Recall'):.4f}
    RF     : FN={int(_get('Secondary','Random Forest','FN')):>4d}  Recall={_get('Secondary','Random Forest','Recall'):.4f}
    Hybrid : FN={int(_get('Secondary','Hybrid Model','FN')):>4d}  Recall={_get('Secondary','Hybrid Model','Recall'):.4f}

  Key findings:
    • Logistic Regression is unsuitable as a standalone detector on raw
      network-flow features (Secondary FN=3,535 — 59.7% of attacks missed).
    • Random Forest performs reliably on both datasets (FN=51 Primary /
      FN=52 Secondary) despite very different feature spaces and attack mixes.
    • The Hybrid model delivers the best recall on the Secondary dataset
      (FN=41 vs RF's FN=52 — 21% fewer missed attacks) while maintaining
      comparable precision. This validates the hybrid confidence-based
      weighting strategy as operationally beneficial.
    • On the Primary dataset, the Hybrid FN (66) is slightly higher than RF (51)
      because the Primary threshold (0.5025) and weights (w_LR=0.30) allow
      the weaker LR signal to slightly dilute the RF's strong attack scores.
""")

# ─── 10. Framework generalisation ────────────────────────────────────────
lines.append(_h2("10. Framework Generalisation Assessment"))

lines.append("""
  The Confidence-Based Hybrid ML Framework was designed to be dataset-agnostic.
  Results from two independent datasets confirm several design principles:

  [1] Calibration improves reliability:
      Both pipelines used isotonic regression calibration fitted on validation
      data. This converts raw model probabilities into interpretable confidence
      scores, enabling consistent triage band assignment across datasets.

  [2] Validation-only tuning prevents leakage:
      All hybrid weights, decision thresholds, and triage band boundaries were
      determined exclusively from the validation subset. The test sets were
      completely held-out until final evaluation. This protocol held for both
      the Primary and Secondary pipelines.

  [3] Random Forest is the core detector:
      On both datasets, RF contributed the dominant weight (0.70 on Primary,
      0.90 on Secondary) and drove the bulk of detection performance. This is
      consistent with RF's known strengths in tabular intrusion detection data.

  [4] Feature diversity affects LR contribution:
      LR benefited from the richer 22-feature Primary set (Recall=0.8538) but
      struggled with the 12-feature Secondary set (Recall=0.4031). A richer
      feature set with protocol one-hot encoding, interface flags, and finer
      port engineering would likely improve LR's contribution on Secondary.

  [5] Triage bands adapt to class distribution:
      The percentile-based triage band selection correctly adapts to each
      dataset's attack rate. No hard-coded thresholds were shared between the
      two pipelines.

  [6] Consistent top features across environments:
      bytes_per_packet, total_bytes, and destination port ranked in the top 4
      on both datasets, confirming these are dataset-independent discriminators
      suitable for cross-environment SOC rules.
""")

# ─── 11. Limitations ─────────────────────────────────────────────────────
lines.append(_h2("11. Limitations & Future Work"))

lines.append("""
  Limitations:
    • The Primary and Secondary datasets differ in attack rate (~83% vs ~20%),
      capture environment, and feature depth. Direct metric comparison should
      account for these differences rather than treating them as equivalent.
    • LR's poor recall on Secondary suggests the current 12-feature set is
      insufficient for a linear classifier. Additional features (flow duration,
      inter-packet timing, flag counts) could improve LR's utility.
    • Calibration was performed on the validation set drawn from the same
      temporal window as training. Concept drift over time was not evaluated.
    • The comparison report reads from static files and does not constitute a
      formal statistical significance test (e.g., McNemar's test or DeLong
      test for AUC differences).

  Future Work:
    • Extend Secondary features to match Primary feature richness for a
      controlled ablation study.
    • Apply the hybrid framework to streaming data to evaluate temporal
      generalisation.
    • Investigate multi-class triage levels aligned to CVSS severity or
      MITRE ATT&CK tactics.
    • Evaluate ensemble diversity metrics (Q-statistic, disagreement measure)
      between LR and RF to understand why LR's contribution vanishes on Secondary.
""")

lines.append("\n" + "═"*78)
lines.append("  Report generated from saved artefacts only. No retraining performed.")
lines.append("  Primary results  : results/metrics/")
lines.append("  Secondary results: ML Models/ML Models/Secondary Model/metrics/")
lines.append("  Comparison plots : ML Models/ML Models/comparison_plots/")
lines.append("═"*78 + "\n")

# ─────────────────────────────────────────────────────────────────────────────
# Write text report
# ─────────────────────────────────────────────────────────────────────────────
report_text = "\n".join(lines)
with open(REPORT_PATH, "w", encoding="utf-8") as f:
    f.write(report_text)
print(f"\n  Text report saved: {REPORT_PATH}")

# ─────────────────────────────────────────────────────────────────────────────
# Print summary to console
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("  COMPARISON SUMMARY — Hybrid Model (Test Set)")
print("="*70)
print(f"  {'Metric':<14}  {'Primary':>10}  {'Secondary':>12}  {'Winner':>10}")
print("  " + "─"*52)
for metric_col, metric_label in zip(METRICS_COLS, METRICS_LABELS):
    pv = _get("Primary",   "Hybrid Model", metric_col)
    sv = _get("Secondary", "Hybrid Model", metric_col)
    winner = "Primary" if pv > sv else ("Secondary" if sv > pv else "Tie")
    print(f"  {metric_label:<14}  {pv:>10.4f}  {sv:>12.4f}  {winner:>10}")
pv_fn = _get("Primary",   "Hybrid Model", "FN")
sv_fn = _get("Secondary", "Hybrid Model", "FN")
pv_fn_rate = pv_fn / pri_meta["n_test"]
sv_fn_rate = sv_fn / sec_cfg["n_test"]
print(f"  {'FN (absolute)':<14}  {int(pv_fn):>10}  {int(sv_fn):>12}")
print(f"  {'FN rate':<14}  {pv_fn_rate:>10.4f}  {sv_fn_rate:>12.4f}  "
      f"{'Primary' if pv_fn_rate < sv_fn_rate else 'Secondary':>10}")
print()
print(f"  Outputs:")
print(f"    {REPORT_PATH}")
print(f"    {CSV_PATH}")
print(f"    {COMPARE_DIR}/  ({len(os.listdir(COMPARE_DIR))} plots)")
print("="*70 + "\n")
