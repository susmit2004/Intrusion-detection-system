"""Small, shared research checks; no I/O or training happens on import."""
from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, average_precision_score, brier_score_loss, confusion_matrix,
    f1_score, log_loss, precision_recall_curve, precision_score, recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def feature_groups(frame):
    """Hash numeric feature vectors, excluding labels and source row indices."""
    return pd.util.hash_pandas_object(frame.astype("float64"), index=False).to_numpy()


def grouped_development_split(features, target, seed=42):
    """Split feature groups ~70/15/15; identical vectors never cross subsets.

    Stratification uses each group's majority binary label, not individual rare
    attack categories. Group sizes mean exact row fractions are not guaranteed.
    """
    groups = feature_groups(features)
    records = pd.DataFrame({"group": groups, "label": np.asarray(target)})
    group_labels = records.groupby("group", sort=True)["label"].mean().ge(0.5).astype(int)
    train_groups, holdout_groups = train_test_split(
        group_labels.index.to_numpy(), test_size=0.30, random_state=seed,
        stratify=group_labels.to_numpy(),
    )
    calibration_groups, tuning_groups = train_test_split(
        holdout_groups, test_size=0.5, random_state=seed + 1,
        stratify=group_labels.loc[holdout_groups].to_numpy(),
    )
    result = {
        name: np.flatnonzero(np.isin(groups, subset))
        for name, subset in [("train", train_groups), ("calibration", calibration_groups),
                             ("tuning", tuning_groups)]
    }
    for name, indices in result.items():
        if len(np.unique(np.asarray(target)[indices])) != 2:
            raise ValueError(f"{name} needs both binary classes")
    return result


def select_f1_threshold(scores, labels):
    """Exact observed-score search; ties prefer the lower threshold/greater recall."""
    precision, recall, thresholds = precision_recall_curve(labels, scores)
    denominator = precision[:-1] + recall[:-1]
    f1 = np.divide(2 * precision[:-1] * recall[:-1], denominator,
                   out=np.zeros_like(denominator), where=denominator > 0)
    best = int(np.flatnonzero(np.isclose(f1, f1.max(), rtol=0, atol=1e-12))[0])
    return {"threshold": float(thresholds[best]), "f1": float(f1[best])}


def metric_record(labels, predictions, probabilities, model, split):
    labels, predictions = np.asarray(labels), np.asarray(predictions)
    probabilities = np.asarray(probabilities)
    tn, fp, fn, tp = confusion_matrix(labels, predictions, labels=[0, 1]).ravel()
    both_classes = len(np.unique(labels)) == 2
    return {
        "model": model, "split": split, "n": int(len(labels)),
        "accuracy": float(accuracy_score(labels, predictions)),
        "precision": float(precision_score(labels, predictions, zero_division=0)),
        "recall": float(recall_score(labels, predictions, zero_division=0)),
        "f1": float(f1_score(labels, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(labels, probabilities)) if both_classes else None,
        "average_precision": float(average_precision_score(labels, probabilities)) if both_classes else None,
        "brier_score": float(brier_score_loss(labels, probabilities)),
        "log_loss": float(log_loss(labels, probabilities, labels=[0, 1])),
        "TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn),
        "false_positive_rate": float(fp / (tn + fp)) if tn + fp else None,
        "false_negative_rate": float(fn / (tp + fn)) if tp + fn else None,
    }


def triage_summary(predictions):
    rows = []
    for level, group in predictions.groupby("triage_level", sort=False):
        rows.append({"triage_level": level, "n": len(group),
                     "fraction": len(group) / len(predictions),
                     "normal": int((group.label_binary == 0).sum()),
                     "attack": int((group.label_binary == 1).sum()),
                     "observed_attack_rate": float(group.label_binary.mean())})
    return pd.DataFrame(rows)
