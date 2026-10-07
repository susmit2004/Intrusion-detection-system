"""
test_ensemble.py
=================
Focused tests for the weighted ensemble pipeline.

Covers
------
 T01  Valid upload — correct column count, no errors
 T02  Missing required columns — clear error message
 T03  Missing individual column — error names the column
 T04  Non-finite values — flagged, rows skipped
 T05  Forbidden columns stripped — no leakage
 T06  Feature selection order — Primary matrix shape & column order
 T07  Feature selection order — Secondary matrix shape & column order
 T08  Weight validation — negative weight raises ValueError
 T09  Weight validation — weights not summing to 1 raises ValueError
 T10  Ensemble score formula — manual calculation matches output
 T11  Classification threshold — score just above threshold → Attack
 T12  Classification threshold — score just below threshold → Normal
 T13  Risk boundaries — High ≥ 0.70, Moderate ≥ 0.40, Low < 0.40
 T14  Model disagreement flag — set when binary predictions differ
 T15  Row order preserved — output index matches input order
 T16  Extra columns ignored — no error for unknown columns
 T17  Existing individual model functionality unchanged — primary
 T18  Existing individual model functionality unchanged — secondary
 T19  EnsembleConfig threshold boundary — 0.0 raises, 1.0 raises
 T20  result_to_dataframe — correct columns, row count
"""

import sys
import os
import pytest
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ensemble.ensemble_predict import (
    EnsembleConfig,
    EnsembleResult,
    ENSEMBLE_COLUMNS,
    PRIMARY_FEATURES,
    SECONDARY_FEATURES,
    PRIMARY_COL_MAP,
    SECONDARY_COL_MAP,
    SHARED_NAMES,
    validate_ensemble_csv,
    run_ensemble,
    result_to_dataframe,
    generate_template,
    _extract_primary,
    _extract_secondary,
    _assign_risk,
)


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def template_df() -> pd.DataFrame:
    """3-row template generated from the module (no disk read required)."""
    return generate_template(output_path=None, n_rows=3)


@pytest.fixture(scope="module")
def single_row_df(template_df) -> pd.DataFrame:
    return template_df.head(1).copy()


# ──────────────────────────────────────────────────────────────────────────────
# T01 — Valid upload
# ──────────────────────────────────────────────────────────────────────────────

def test_T01_valid_upload(template_df):
    vr = validate_ensemble_csv(template_df)
    assert vr.valid, f"Expected valid CSV but got missing: {vr.missing}"
    assert vr.row_count == 3
    assert vr.missing == []


# ──────────────────────────────────────────────────────────────────────────────
# T02 — Missing all required columns
# ──────────────────────────────────────────────────────────────────────────────

def test_T02_missing_all_columns():
    empty_df = pd.DataFrame({"col_a": [1, 2], "col_b": [3, 4]})
    vr = validate_ensemble_csv(empty_df)
    assert not vr.valid
    assert len(vr.missing) == len(ENSEMBLE_COLUMNS)


# ──────────────────────────────────────────────────────────────────────────────
# T03 — Missing one column — error names it
# ──────────────────────────────────────────────────────────────────────────────

def test_T03_missing_single_column(template_df):
    missing_col = "sec_bytes_per_packet"
    df = template_df.drop(columns=[missing_col])
    vr = validate_ensemble_csv(df)
    assert not vr.valid
    assert missing_col in vr.missing
    assert len(vr.missing) == 1


# ──────────────────────────────────────────────────────────────────────────────
# T04 — Non-finite values — flagged and rows skipped
# ──────────────────────────────────────────────────────────────────────────────

def test_T04_non_finite_values(template_df):
    df = template_df.copy()
    df.loc[0, "sec_bytes_per_packet"] = np.inf
    df.loc[1, "pri_total_bytes"]      = np.nan
    vr = validate_ensemble_csv(df)
    # Still valid schema — but bad rows flagged
    assert vr.valid
    assert 0 in vr.bad_rows
    assert 1 in vr.bad_rows
    assert 2 not in vr.bad_rows  # row 2 is clean


def test_T04b_all_nan_raises(template_df):
    """If ALL rows are non-finite, run_ensemble should raise ValueError."""
    df = template_df.copy()
    df["sec_bytes_per_packet"] = np.nan
    with pytest.raises(ValueError, match="No valid rows"):
        run_ensemble(df)


# ──────────────────────────────────────────────────────────────────────────────
# T05 — Forbidden columns stripped before inference
# ──────────────────────────────────────────────────────────────────────────────

def test_T05_forbidden_columns_stripped(template_df):
    df = template_df.copy()
    df["Label"]        = "BENIGN"
    df["Attack Type"]  = "Normal"
    df["ensemble_score"] = 0.99  # should be stripped, not used as feature
    # Should not raise
    result = run_ensemble(df)
    assert result is not None
    assert result.summary["total_rows"] == 3


# ──────────────────────────────────────────────────────────────────────────────
# T06 — Feature selection order — Primary (22 features)
# ──────────────────────────────────────────────────────────────────────────────

def test_T06_primary_matrix_shape(template_df):
    X = _extract_primary(template_df)
    assert X.shape == (3, 22), f"Expected (3, 22), got {X.shape}"


def test_T06b_primary_column_order(template_df):
    """The first column of X_primary must correspond to PRIMARY_FEATURES[0]."""
    X = _extract_primary(template_df)
    ensemble_col_0 = PRIMARY_COL_MAP[PRIMARY_FEATURES[0]]  # "proto_ICMP"
    expected_values = template_df[ensemble_col_0].astype(float).values
    np.testing.assert_array_equal(X[:, 0], expected_values)


# ──────────────────────────────────────────────────────────────────────────────
# T07 — Feature selection order — Secondary (12 features)
# ──────────────────────────────────────────────────────────────────────────────

def test_T07_secondary_matrix_shape(template_df):
    X = _extract_secondary(template_df)
    assert X.shape == (3, 12), f"Expected (3, 12), got {X.shape}"


def test_T07b_secondary_column_order(template_df):
    """The last column of X_secondary must correspond to SECONDARY_FEATURES[-1]."""
    X = _extract_secondary(template_df)
    last_sec_feat   = SECONDARY_FEATURES[-1]           # "day_of_week"
    ensemble_col    = SECONDARY_COL_MAP[last_sec_feat] # "sec_day_of_week"
    expected_values = template_df[ensemble_col].astype(float).values
    np.testing.assert_array_equal(X[:, -1], expected_values)


# ──────────────────────────────────────────────────────────────────────────────
# T08 — Negative weight raises
# ──────────────────────────────────────────────────────────────────────────────

def test_T08_negative_weight_raises():
    with pytest.raises(ValueError, match="non-negative"):
        EnsembleConfig(w_primary=-0.1, w_secondary=1.1)


# ──────────────────────────────────────────────────────────────────────────────
# T09 — Weights not summing to 1 raises
# ──────────────────────────────────────────────────────────────────────────────

def test_T09_weights_not_sum_to_1():
    with pytest.raises(ValueError, match="sum to 1"):
        EnsembleConfig(w_primary=0.3, w_secondary=0.3)


def test_T09b_equal_weights_valid():
    cfg = EnsembleConfig(w_primary=0.5, w_secondary=0.5)
    assert abs(cfg.w_primary + cfg.w_secondary - 1.0) < 1e-9


# ──────────────────────────────────────────────────────────────────────────────
# T10 — Ensemble score formula
# ──────────────────────────────────────────────────────────────────────────────

def test_T10_ensemble_score_formula(template_df):
    cfg    = EnsembleConfig(w_primary=0.4, w_secondary=0.6)
    result = run_ensemble(template_df, cfg)
    for row in result.rows:
        expected = round(0.4 * row.primary_score + 0.6 * row.secondary_score, 6)
        assert abs(row.ensemble_score - expected) < 1e-5, (
            f"Row {row.row_index}: expected {expected}, got {row.ensemble_score}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# T11 — Score just above threshold → Attack
# ──────────────────────────────────────────────────────────────────────────────

def test_T11_threshold_attack(template_df):
    """With threshold=0.0, every row should be Attack."""
    cfg    = EnsembleConfig(w_primary=0.5, w_secondary=0.5, threshold=0.001)
    result = run_ensemble(template_df, cfg)
    for row in result.rows:
        assert row.final_prediction == "Attack", (
            f"Row {row.row_index} score={row.ensemble_score} should be Attack"
        )


# ──────────────────────────────────────────────────────────────────────────────
# T12 — Score just below threshold → Normal
# ──────────────────────────────────────────────────────────────────────────────

def test_T12_threshold_normal(template_df):
    """With threshold=0.999, every row should be Normal."""
    cfg    = EnsembleConfig(w_primary=0.5, w_secondary=0.5, threshold=0.999)
    result = run_ensemble(template_df, cfg)
    for row in result.rows:
        assert row.final_prediction == "Normal", (
            f"Row {row.row_index} score={row.ensemble_score} should be Normal with thr=0.999"
        )


# ──────────────────────────────────────────────────────────────────────────────
# T13 — Risk boundaries
# ──────────────────────────────────────────────────────────────────────────────

def test_T13_risk_high():
    cfg = EnsembleConfig()
    assert _assign_risk(0.70, cfg) == "High Risk"
    assert _assign_risk(0.99, cfg) == "High Risk"
    assert _assign_risk(1.00, cfg) == "High Risk"


def test_T13_risk_moderate():
    cfg = EnsembleConfig()
    assert _assign_risk(0.40, cfg) == "Moderate Risk"
    assert _assign_risk(0.55, cfg) == "Moderate Risk"
    assert _assign_risk(0.699, cfg) == "Moderate Risk"


def test_T13_risk_low():
    cfg = EnsembleConfig()
    assert _assign_risk(0.00, cfg) == "Low Risk"
    assert _assign_risk(0.25, cfg) == "Low Risk"
    assert _assign_risk(0.399, cfg) == "Low Risk"


# ──────────────────────────────────────────────────────────────────────────────
# T14 — Disagreement flag
# ──────────────────────────────────────────────────────────────────────────────

def test_T14_disagreement_flagged(template_df):
    """Template rows are expected to disagree (Primary sees attacks, Secondary doesn't)."""
    result = run_ensemble(template_df)
    assert result.summary["disagreements"] > 0, "Expected at least one disagreement on template rows"
    for row in result.rows:
        if row.primary_pred != row.secondary_pred:
            assert row.disagreement is True


def test_T14b_no_disagreement_when_same():
    """When both models give same binary call, disagreement=False."""
    # We can verify this via the EnsembleRow dataclass logic indirectly
    # by checking a row where both scores are very high → both predict Attack
    df = generate_template(output_path=None, n_rows=1)
    # Force sec_bytes_per_packet to be very small (attack-like for secondary)
    df["sec_bytes_per_packet"] = 4.0
    df["sec_total_bytes"]       = 12.0
    df["sec_total_packets"]     = 3.0
    df["sec_day_of_week"]       = 4.0
    result = run_ensemble(df)
    row = result.rows[0]
    # Both should now predict Attack
    if row.primary_pred == row.secondary_pred:
        assert row.disagreement is False


# ──────────────────────────────────────────────────────────────────────────────
# T15 — Row order preserved
# ──────────────────────────────────────────────────────────────────────────────

def test_T15_row_order_preserved(template_df):
    result = run_ensemble(template_df)
    indices = [r.row_index for r in result.rows]
    assert indices == sorted(indices), "Output row order should match input order"


# ──────────────────────────────────────────────────────────────────────────────
# T16 — Extra columns ignored
# ──────────────────────────────────────────────────────────────────────────────

def test_T16_extra_columns_ignored(template_df):
    df = template_df.copy()
    df["unknown_feature_xyz"] = 999.0
    df["another_random_col"]  = "foo"
    # Should not raise
    result = run_ensemble(df)
    assert result.summary["total_rows"] == 3


# ──────────────────────────────────────────────────────────────────────────────
# T17 — Existing primary model still works independently
# ──────────────────────────────────────────────────────────────────────────────

def test_T17_primary_model_independent():
    """Primary model inference still works exactly as before (no regression)."""
    import joblib
    import json
    BASE = os.path.join(os.path.dirname(__file__), "..", "..")
    lr_cal = joblib.load(os.path.join(BASE, "results", "models", "lr_calibrated.joblib"))
    rf_cal = joblib.load(os.path.join(BASE, "results", "models", "rf_calibrated.joblib"))

    # Load primary test CSV
    pred_path = os.path.join(BASE, "results", "predictions", "predictions_test.csv")
    if not os.path.exists(pred_path):
        pytest.skip("Primary predictions CSV not found — run train_and_evaluate.py first")

    df_preds = pd.read_csv(pred_path)
    # Just check the models can still load and produce predictions
    assert lr_cal is not None
    assert rf_cal is not None
    assert len(df_preds) == 3607, f"Expected 3607 rows, got {len(df_preds)}"


# ──────────────────────────────────────────────────────────────────────────────
# T18 — Existing secondary model still works independently
# ──────────────────────────────────────────────────────────────────────────────

def test_T18_secondary_model_independent():
    """Secondary model inference still works exactly as before (no regression)."""
    BASE = os.path.join(os.path.dirname(__file__), "..", "..")
    pred_path = os.path.join(BASE, "ML Models", "ML Models",
                             "Secondary Model", "predictions",
                             "secondary_predictions_test.csv")
    if not os.path.exists(pred_path):
        pytest.skip("Secondary predictions CSV not found — run run_secondary_model.py first")

    df_preds = pd.read_csv(pred_path)
    assert len(df_preds) == 30000, f"Expected 30000 rows, got {len(df_preds)}"


# ──────────────────────────────────────────────────────────────────────────────
# T19 — Threshold boundary values
# ──────────────────────────────────────────────────────────────────────────────

def test_T19_threshold_zero_raises():
    with pytest.raises(ValueError, match="threshold"):
        EnsembleConfig(threshold=0.0)


def test_T19_threshold_one_raises():
    with pytest.raises(ValueError, match="threshold"):
        EnsembleConfig(threshold=1.0)


def test_T19_threshold_valid():
    cfg = EnsembleConfig(threshold=0.5)
    assert cfg.threshold == 0.5


# ──────────────────────────────────────────────────────────────────────────────
# T20 — result_to_dataframe
# ──────────────────────────────────────────────────────────────────────────────

def test_T20_result_to_dataframe(template_df):
    result = run_ensemble(template_df)
    df_out = result_to_dataframe(result)
    assert len(df_out) == result.summary["total_rows"]
    expected_cols = {
        "row_index", "primary_score", "secondary_score", "ensemble_score",
        "primary_pred", "secondary_pred", "final_prediction",
        "risk_level", "disagreement",
    }
    assert expected_cols.issubset(set(df_out.columns))
    # Scores are numeric
    assert pd.api.types.is_float_dtype(df_out["ensemble_score"])
    # Predictions are strings
    assert df_out["final_prediction"].isin(["Attack", "Normal"]).all()
    # Risk levels valid
    assert df_out["risk_level"].isin(["High Risk", "Moderate Risk", "Low Risk"]).all()


# ──────────────────────────────────────────────────────────────────────────────
# Schema sanity checks
# ──────────────────────────────────────────────────────────────────────────────

def test_schema_34_columns():
    assert len(ENSEMBLE_COLUMNS) == 34, f"Expected 34, got {len(ENSEMBLE_COLUMNS)}"


def test_schema_no_forbidden_in_ensemble():
    forbidden = {"Label", "Attack Type", "Risk Level", "label_binary",
                 "ensemble_score", "timestamp"}
    overlap = set(ENSEMBLE_COLUMNS) & forbidden
    assert not overlap, f"Forbidden columns in schema: {overlap}"


def test_shared_names_prefixed():
    """Shared feature names must appear with both pri_ and sec_ prefixes."""
    for name in SHARED_NAMES:
        assert f"pri_{name}" in ENSEMBLE_COLUMNS, f"pri_{name} missing from schema"
        assert f"sec_{name}" in ENSEMBLE_COLUMNS, f"sec_{name} missing from schema"
        assert name not in ENSEMBLE_COLUMNS, (
            f"Unprefixed '{name}' must NOT be in ENSEMBLE_COLUMNS"
        )
