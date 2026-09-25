"""
models.py
=========
Trains Logistic Regression and Random Forest base models using ONLY
training data. Returns fitted models and their validation / test
probability outputs.

Design notes
-------------
* Logistic Regression requires StandardScaler (included in a Pipeline).
* Random Forest is tree-based and does not require feature scaling.
* class_weight='balanced' is set on both models to handle the ~82/18 imbalance.
* Probability calibration is applied using CalibratedClassifierCV on the
  validation set and clearly distinguished from raw probabilities.
* Fixed RANDOM_SEED ensures reproducibility.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
import joblib
import os

from src.config import (
    LR_PARAMS, RF_PARAMS, RANDOM_SEED,
    MODEL_DIR, CALIBRATION_METHOD,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


# ---------------------------------------------------------------------------
# Model builders
# ---------------------------------------------------------------------------

def build_lr_pipeline() -> Pipeline:
    """
    Returns an sklearn Pipeline:
        StandardScaler → LogisticRegression
    Scaling is required for LR because features span very different
    magnitude ranges (e.g., port numbers 0-65535 vs binary flags 0/1).
    """
    lr = LogisticRegression(**LR_PARAMS)
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("lr",     lr),
    ])
    return pipeline


def build_rf() -> RandomForestClassifier:
    """
    Returns a RandomForestClassifier WITHOUT any scaling.
    Tree-based models are invariant to monotonic feature transformations,
    so scaling is unnecessary and would obscure feature importances.
    """
    return RandomForestClassifier(**RF_PARAMS)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_models(
    X_train: pd.DataFrame,
    y_train: np.ndarray,
    X_val:   pd.DataFrame,
    y_val:   np.ndarray,
) -> dict:
    """
    Fit LR pipeline and RF on training data only.
    Also fits calibrated wrappers on the validation set.

    Parameters
    ----------
    X_train, y_train : training features and labels
    X_val,   y_val   : validation features and labels
                       (used ONLY for calibration, never for weight/threshold
                        selection inside this function)

    Returns
    -------
    dict with keys:
        lr_pipeline          – fitted LR Pipeline (scaler + LR)
        rf                   – fitted RandomForestClassifier
        lr_calibrated        – CalibratedClassifierCV on LR (cv='prefit')
        rf_calibrated        – CalibratedClassifierCV on RF (cv='prefit')
        X_val_scaled         – validation features after LR's scaler (informational)
    """
    print("\n" + "="*60)
    print("  Training Logistic Regression (with StandardScaler pipeline)")
    print("="*60)
    lr_pipeline = build_lr_pipeline()
    lr_pipeline.fit(X_train, y_train)
    print("  LR training complete ✓")

    print("\n" + "="*60)
    print("  Training Random Forest Classifier (no scaling)")
    print("="*60)
    rf = build_rf()
    rf.fit(X_train, y_train)
    print(f"  RF training complete ✓  ({rf.n_estimators} trees)")

    # ------------------------------------------------------------------
    # Probability calibration
    # NOTE: cv='prefit' means the base estimator is already fitted and
    # CalibratedClassifierCV will fit calibration on the provided X_val/y_val.
    # This is valid because X_val / y_val were NOT used during model training.
    # We document clearly that calibrated_proba ≠ raw_proba.
    # ------------------------------------------------------------------
    print("\n" + "="*60)
    print("  Calibrating probabilities (method='{}') on validation set".format(
        CALIBRATION_METHOD))
    print("  NOTE: Calibrated scores ≠ raw probabilities.")
    print("  Raw LR/RF probabilities are model outputs; calibrated scores")
    print("  are post-hoc adjustments to align predicted probabilities with")
    print("  empirical frequencies — they remain estimates, not guarantees.")
    print("="*60)

    # Probability calibration strategy
    # ---------------------------------
    # We want to calibrate using ONLY the validation set (X_val / y_val),
    # which was never seen during model training.  The sklearn approach for
    # this is to fit a CalibratedClassifierCV with cv=5 on the validation data
    # (it will re-train 5 folds internally on validation, which is fine since
    # the validation set is clean and separate from training).
    # This is the correct API for sklearn >= 1.2 where cv='prefit' was removed.
    #
    # Why not use cv='prefit'?
    #   - Removed in sklearn 1.4+.  Replaced by fitting on held-out data.
    # Why not calibrate on training data?
    #   - Would not test generalisation; validation is the correct set.
    lr_calibrated = CalibratedClassifierCV(
        estimator=lr_pipeline, method=CALIBRATION_METHOD, cv=5
    )
    lr_calibrated.fit(X_val, y_val)
    print("  LR calibration complete ✓")

    rf_calibrated = CalibratedClassifierCV(
        estimator=rf, method=CALIBRATION_METHOD, cv=5
    )
    rf_calibrated.fit(X_val, y_val)
    print("  RF calibration complete ✓")

    # Convenience: expose scaled validation features for diagnostics
    X_val_scaled = lr_pipeline.named_steps["scaler"].transform(X_val)

    return {
        "lr_pipeline":    lr_pipeline,
        "rf":             rf,
        "lr_calibrated":  lr_calibrated,
        "rf_calibrated":  rf_calibrated,
        "X_val_scaled":   X_val_scaled,
    }


# ---------------------------------------------------------------------------
# Prediction helpers
# ---------------------------------------------------------------------------

def get_probabilities(
    models: dict,
    X: pd.DataFrame,
    split_name: str = "unknown",
) -> dict:
    """
    Generate raw and calibrated class-1 probabilities for a given split.

    Returns
    -------
    dict with keys:
        lr_prob_raw        – raw LR predict_proba[:, 1]
        lr_prob_calibrated – calibrated LR probabilities[:, 1]
        rf_prob_raw        – raw RF predict_proba[:, 1]
        rf_prob_calibrated – calibrated RF probabilities[:, 1]
        lr_pred            – hard predictions from LR (threshold 0.5)
        rf_pred            – hard predictions from RF (threshold 0.5)
    """
    print(f"  Generating predictions for split: {split_name}")

    lr_prob_raw  = models["lr_pipeline"].predict_proba(X)[:, 1]
    rf_prob_raw  = models["rf"].predict_proba(X)[:, 1]
    lr_prob_cal  = models["lr_calibrated"].predict_proba(X)[:, 1]
    rf_prob_cal  = models["rf_calibrated"].predict_proba(X)[:, 1]

    lr_pred = (lr_prob_raw >= 0.5).astype(int)
    rf_pred = (rf_prob_raw >= 0.5).astype(int)

    return {
        "lr_prob_raw":        lr_prob_raw,
        "lr_prob_calibrated": lr_prob_cal,
        "rf_prob_raw":        rf_prob_raw,
        "rf_prob_calibrated": rf_prob_cal,
        "lr_pred":            lr_pred,
        "rf_pred":            rf_pred,
    }


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def save_models(models: dict) -> None:
    """Persist all model artefacts to MODEL_DIR using joblib."""
    _ensure_dir(MODEL_DIR)
    artefacts = {
        "lr_pipeline":   "lr_pipeline.joblib",
        "rf":            "rf_model.joblib",
        "lr_calibrated": "lr_calibrated.joblib",
        "rf_calibrated": "rf_calibrated.joblib",
    }
    for key, filename in artefacts.items():
        path = os.path.join(MODEL_DIR, filename)
        joblib.dump(models[key], path)
        print(f"  Saved: {path}")


def load_models() -> dict:
    """Re-load persisted model artefacts from MODEL_DIR."""
    artefacts = {
        "lr_pipeline":   "lr_pipeline.joblib",
        "rf":            "rf_model.joblib",
        "lr_calibrated": "lr_calibrated.joblib",
        "rf_calibrated": "rf_calibrated.joblib",
    }
    models = {}
    for key, filename in artefacts.items():
        path = os.path.join(MODEL_DIR, filename)
        models[key] = joblib.load(path)
    return models
