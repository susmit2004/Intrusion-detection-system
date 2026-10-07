"""
feature_analysis.py
===================
Analyses Random Forest feature importances and compares traffic
behaviour between normal and attack events.

Outputs
-------
  artifacts/primary/plots/feature_importance.png
  artifacts/primary/metrics/feature_importance.csv
  artifacts/primary/plots/feature_distribution_comparison.png
  artifacts/primary/metrics/feature_stats_by_class.csv
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import os

from src.config import METRICS_DIR, PLOTS_DIR, FEATURE_COLS


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ensure_dirs() -> None:
    os.makedirs(METRICS_DIR, exist_ok=True)
    os.makedirs(PLOTS_DIR,   exist_ok=True)


# ---------------------------------------------------------------------------
# Feature importance
# ---------------------------------------------------------------------------

def analyse_feature_importance(rf_model, feature_names: list) -> pd.DataFrame:
    """
    Extract and plot Random Forest feature importances (Gini impurity decrease).
    Returns a sorted DataFrame for dashboard use.
    """
    _ensure_dirs()

    importances = rf_model.feature_importances_
    df_imp = pd.DataFrame({
        "feature":    feature_names,
        "importance": importances,
    }).sort_values("importance", ascending=False).reset_index(drop=True)

    # Save CSV
    csv_path = os.path.join(METRICS_DIR, "feature_importance.csv")
    df_imp.to_csv(csv_path, index=False)
    print(f"  Feature importance saved: {csv_path}")

    # Plot
    fig, ax = plt.subplots(figsize=(9, 7))
    colors = plt.cm.RdYlGn_r(np.linspace(0.15, 0.85, len(df_imp)))
    ax.barh(
        df_imp["feature"][::-1],
        df_imp["importance"][::-1],
        color=colors[::-1],
        edgecolor="white",
        linewidth=0.5,
    )
    ax.set_xlabel("Mean Decrease in Gini Impurity", fontsize=11)
    ax.set_title(
        "Random Forest Feature Importances\n"
        "(Higher = more influential in detecting suspicious traffic)",
        fontsize=12, fontweight="bold",
    )
    ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()
    plot_path = os.path.join(PLOTS_DIR, "feature_importance.png")
    fig.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Feature importance plot saved: {plot_path}")

    print("\n  Top 10 most important features:")
    for _, row in df_imp.head(10).iterrows():
        print(f"    {row['feature']:<35s}  {row['importance']:.5f}")

    return df_imp


# ---------------------------------------------------------------------------
# Traffic pattern comparison
# ---------------------------------------------------------------------------

def analyse_traffic_patterns(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    top_features: list = None,
) -> pd.DataFrame:
    """
    Compare feature distributions between Normal (0) and Attack (1) traffic.
    Focuses on the top_features if provided, otherwise uses all features.

    Returns a summary DataFrame with mean, std, median per class.
    """
    _ensure_dirs()

    if top_features is None:
        top_features = FEATURE_COLS

    # Limit to features that actually exist in X_train
    top_features = [f for f in top_features if f in X_train.columns]

    df = X_train[top_features].copy()
    df["label"] = y_train

    # Per-class statistics
    stats = df.groupby("label")[top_features].agg(["mean", "std", "median"]).round(4)
    stats.index = ["Normal", "Attack"]
    stats_flat = stats.T  # rows=features, cols=(Normal/Attack)×stats

    csv_path = os.path.join(METRICS_DIR, "feature_stats_by_class.csv")
    stats_flat.to_csv(csv_path)
    print(f"  Traffic pattern stats saved: {csv_path}")

    # Distribution comparison plots (top 8 features by variance difference)
    n_plot   = min(8, len(top_features))
    fig, axes = plt.subplots(2, 4, figsize=(16, 8)) if n_plot >= 8 else \
                plt.subplots(1, n_plot, figsize=(4 * n_plot, 4))
    axes = np.array(axes).ravel()

    for i, feat in enumerate(top_features[:n_plot]):
        ax = axes[i]
        normal_vals = df.loc[df["label"] == 0, feat]
        attack_vals = df.loc[df["label"] == 1, feat]

        # Use KDE for continuous; bar for binary flags
        unique_vals = df[feat].nunique()
        if unique_vals <= 3:
            counts = df.groupby("label")[feat].value_counts(normalize=True).unstack(fill_value=0)
            counts.index = ["Normal", "Attack"]
            counts.T.plot(kind="bar", ax=ax, color=["#2196F3", "#F44336"],
                          alpha=0.8, edgecolor="white")
            ax.set_ylabel("Proportion")
        else:
            # Clip extreme outliers for readability
            p01 = df[feat].quantile(0.01)
            p99 = df[feat].quantile(0.99)
            n = normal_vals.clip(p01, p99)
            a = attack_vals.clip(p01, p99)
            ax.hist(n, bins=40, alpha=0.6, color="#2196F3", label="Normal",  density=True)
            ax.hist(a, bins=40, alpha=0.6, color="#F44336", label="Attack",  density=True)
            ax.legend(fontsize=8)
            ax.set_ylabel("Density")

        ax.set_title(feat, fontsize=9, fontweight="bold")
        ax.set_xlabel(feat, fontsize=8)
        ax.tick_params(axis="x", labelsize=8)
        ax.tick_params(axis="y", labelsize=8)

    # Hide unused axes
    for j in range(n_plot, len(axes)):
        axes[j].set_visible(False)

    plt.suptitle(
        "Traffic Feature Distributions: Normal vs Attack",
        fontsize=13, fontweight="bold", y=1.01,
    )
    plt.tight_layout()
    plot_path = os.path.join(PLOTS_DIR, "feature_distribution_comparison.png")
    fig.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"  Feature distribution comparison saved: {plot_path}")

    return stats_flat
