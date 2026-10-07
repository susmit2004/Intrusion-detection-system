"""
ensemble_predict.py
====================
Weighted ensemble of the Primary (Suricata) and Secondary (CIC-IDS-2017)
hybrid ML models.

Key design decisions
---------------------
* Each model receives ONLY the features it was trained on, in the exact
  order its scaler/pipeline expects — no column reuse between models.
* The five column names that appear in both feature lists
  (bytes_per_packet, total_bytes, total_packets, hour_of_day, day_of_week)
  have incompatible data scales across datasets (e.g. bytes_per_packet mean
  is 115 638 for Primary vs 186 for Secondary).  The user therefore supplies
  them as separate prefixed columns in the ensemble CSV:
      pri_bytes_per_packet, pri_total_bytes, pri_total_packets,
      pri_hour_of_day, pri_day_of_week
      sec_bytes_per_packet  (= raw 'bytes_per_packet'),
      sec_total_bytes, sec_total_packets, sec_hour_of_day, sec_day_of_week
* Total ensemble CSV columns: 34
* Ensemble score:
      ensemble_score = w_primary * primary_hybrid_cal
                     + w_secondary * secondary_hybrid_cal
  Both component scores are isotonic-calibrated probabilities on [0, 1]
  with the same semantic: P(row is an Attack).
* Default weights 0.5 / 0.5 — no held-out validation data supports any
  other split, so equal weighting is the honest default.
* Default classification threshold 0.5 — midpoint of calibrated [0,1].
* Risk levels (reused from secondary model, labelled as demo defaults):
      High Risk     : ensemble_score >= 0.70
      Moderate Risk : 0.40 <= ensemble_score < 0.70
      Low Risk      : ensemble_score < 0.40
* Model disagreement is flagged whenever primary and secondary
  binary predictions differ.
* Ensemble mode requires BOTH models to succeed for a given row.
  Rows with invalid feature values raise a clear error — no silent fallback.
"""

from __future__ import annotations

import os
import sys
import json
import warnings
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
_BASE = os.path.dirname(_HERE)           # project root

_PRI_MODEL_DIR = os.path.join(_BASE, "results", "models")
_SEC_MODEL_DIR = os.path.join(_BASE, "ML Models", "ML Models",
                               "Secondary Model", "models")
_PRI_META_PATH = os.path.join(_BASE, "results", "metrics",
                               "experiment_metadata.json")
_SEC_CFG_PATH  = os.path.join(_BASE, "ML Models", "ML Models",
                               "Secondary Model", "metrics",
                               "secondary_experiment_config.json")

# ──────────────────────────────────────────────────────────────────────────────
# Schema constants
# ──────────────────────────────────────────────────────────────────────────────

# Exact feature order required by each model (from training metadata)
PRIMARY_FEATURES: list[str] = [
    "proto_ICMP", "proto_TCP", "proto_UDP",
    "iface_ens192", "iface_eth0",
    "src_port_clean", "dest_port_clean",
    "has_ports", "is_well_known_port", "is_ephemeral_src_port",
    "flow_pkts_toserver", "flow_pkts_toclient",
    "total_packets",
    "flow_bytes_toserver", "flow_bytes_toclient",
    "total_bytes", "bytes_per_packet",
    "avg_bytes_toserver_per_pkt", "pkt_asymmetry_ratio",
    "hour_of_day", "day_of_week", "is_weekend",
]

SECONDARY_FEATURES: list[str] = [
    "Source Port", "Destination Port",
    "Total Fwd Packets", "Total Backward Packets",
    "Total Length of Fwd Packets", "Total Length of Bwd Packets",
    "total_packets", "total_bytes", "bytes_per_packet",
    "packet_asymmetry_ratio",
    "hour_of_day", "day_of_week",
]

# The 5 features whose names overlap but whose scales are incompatible.
# The CSV user must supply them with prefixes so each model gets the value
# scaled to its own training distribution.
SHARED_NAMES: set[str] = {
    "bytes_per_packet", "total_bytes", "total_packets",
    "hour_of_day", "day_of_week",
}

# Mapping: ensemble CSV column  →  primary feature column name
PRIMARY_COL_MAP: dict[str, str] = {
    col: (f"pri_{col}" if col in SHARED_NAMES else col)
    for col in PRIMARY_FEATURES
}
# inverse
PRI_ENSEMBLE_TO_MODEL: dict[str, str] = {v: k for k, v in PRIMARY_COL_MAP.items()}

# Mapping: ensemble CSV column  →  secondary feature column name
SECONDARY_COL_MAP: dict[str, str] = {
    col: (f"sec_{col}" if col in SHARED_NAMES else col)
    for col in SECONDARY_FEATURES
}
SEC_ENSEMBLE_TO_MODEL: dict[str, str] = {v: k for k, v in SECONDARY_COL_MAP.items()}

# Full 34-column ensemble schema (sorted for stable CSV headers)
ENSEMBLE_COLUMNS: list[str] = sorted(
    set(PRIMARY_COL_MAP.values()) | set(SECONDARY_COL_MAP.values())
)

# Columns that must NEVER be passed as model inputs (leakage guard)
FORBIDDEN_COLS: set[str] = {
    "Label", "Attack Type", "Risk Level", "label_binary",
    "ensemble_score", "primary_score", "secondary_score",
    "primary_pred", "secondary_pred", "final_prediction",
    "risk_level", "disagreement", "alert_signature", "alert_category",
    "flow_id", "src_ip", "dest_ip", "timestamp",
}

# Risk thresholds (demo defaults — not validated on a held-out set)
RISK_HIGH_THR     = 0.70
RISK_MODERATE_THR = 0.40

# ──────────────────────────────────────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class EnsembleConfig:
    """User-configurable parameters for the ensemble."""
    w_primary:   float = 0.5   # weight for primary hybrid score
    w_secondary: float = 0.5   # weight for secondary hybrid score
    threshold:   float = 0.5   # classification threshold on ensemble score
    risk_high_threshold:     float = RISK_HIGH_THR
    risk_moderate_threshold: float = RISK_MODERATE_THR

    def __post_init__(self) -> None:
        if self.w_primary < 0 or self.w_secondary < 0:
            raise ValueError("Weights must be non-negative.")
        total = self.w_primary + self.w_secondary
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Weights must sum to 1.0 (got {total:.6f}). "
                "Normalise them before passing to EnsembleConfig."
            )
        if not 0.0 < self.threshold < 1.0:
            raise ValueError("threshold must be in (0, 1).")


@dataclass
class EnsembleRow:
    """Prediction result for a single input row."""
    row_index:        int
    primary_score:    float        # primary hybrid calibrated score
    secondary_score:  float        # secondary hybrid calibrated score
    ensemble_score:   float        # weighted average
    primary_pred:     int          # 0=Normal, 1=Attack (primary threshold)
    secondary_pred:   int          # 0=Normal, 1=Attack (secondary threshold)
    final_prediction: str          # "Attack" or "Normal"
    risk_level:       str          # "High Risk" / "Moderate Risk" / "Low Risk"
    disagreement:     bool         # True when models give different binary calls


@dataclass
class ValidationResult:
    """Outcome of CSV schema + value validation."""
    valid:       bool
    missing:     list[str] = field(default_factory=list)
    forbidden:   list[str] = field(default_factory=list)
    bad_rows:    dict[int, str] = field(default_factory=dict)
    row_count:   int = 0
    warnings:    list[str] = field(default_factory=list)


@dataclass
class EnsembleResult:
    """Full batch result returned by run_ensemble()."""
    config:         EnsembleConfig
    rows:           list[EnsembleRow]
    summary:        dict
    errors:         list[str] = field(default_factory=list)
    processing_ms:  float = 0.0


# ──────────────────────────────────────────────────────────────────────────────
# Model loader (singleton cache)
# ──────────────────────────────────────────────────────────────────────────────

class _ModelCache:
    _instance: Optional["_ModelCache"] = None

    def __init__(self) -> None:
        self._loaded = False
        self.pri_lr_pipeline  = None
        self.pri_lr_cal       = None
        self.pri_rf_model     = None
        self.pri_rf_cal       = None
        self.sec_lr_pipeline  = None
        self.sec_lr_cal       = None
        self.sec_rf_model     = None
        self.sec_rf_cal       = None
        self.pri_w1 = 0.3; self.pri_w2 = 0.7
        self.pri_threshold = 0.5025
        self.sec_w1 = 0.0; self.sec_w2 = 1.0
        self.sec_threshold = 0.4536

    @classmethod
    def get(cls) -> "_ModelCache":
        if cls._instance is None:
            cls._instance = _ModelCache()
        if not cls._instance._loaded:
            cls._instance._load()
        return cls._instance

    def _load(self) -> None:
        errors = []
        for attr, path in [
            ("pri_lr_pipeline", os.path.join(_PRI_MODEL_DIR, "lr_pipeline.joblib")),
            ("pri_lr_cal",      os.path.join(_PRI_MODEL_DIR, "lr_calibrated.joblib")),
            ("pri_rf_model",    os.path.join(_PRI_MODEL_DIR, "rf_model.joblib")),
            ("pri_rf_cal",      os.path.join(_PRI_MODEL_DIR, "rf_calibrated.joblib")),
            ("sec_lr_pipeline", os.path.join(_SEC_MODEL_DIR, "secondary_lr_pipeline.joblib")),
            ("sec_lr_cal",      os.path.join(_SEC_MODEL_DIR, "secondary_lr_calibrated.joblib")),
            ("sec_rf_model",    os.path.join(_SEC_MODEL_DIR, "secondary_rf_model.joblib")),
            ("sec_rf_cal",      os.path.join(_SEC_MODEL_DIR, "secondary_rf_calibrated.joblib")),
        ]:
            if not os.path.exists(path):
                errors.append(f"Model file not found: {path}")
                continue
            try:
                setattr(self, attr, joblib.load(path))
            except Exception as exc:
                errors.append(f"Failed to load {path}: {exc}")

        if errors:
            raise RuntimeError(
                "Model loading failed:\n" + "\n".join(f"  {e}" for e in errors)
            )

        # Load thresholds from config files
        try:
            with open(_PRI_META_PATH) as f:
                pm = json.load(f)
            # Use hybrid_config.json for primary thresholds
            hc_path = os.path.join(_BASE, "results", "metrics", "hybrid_config.json")
            with open(hc_path) as f:
                hc = json.load(f)
            self.pri_w1 = float(hc["w1_lr"])
            self.pri_w2 = float(hc["w2_rf"])
            self.pri_threshold = float(hc["decision_threshold"])
        except Exception:
            pass  # keep defaults

        try:
            with open(_SEC_CFG_PATH, encoding="utf-8") as f:
                sc = json.load(f)
            self.sec_w1 = float(sc["hybrid_w1_lr"])
            self.sec_w2 = float(sc["hybrid_w2_rf"])
            self.sec_threshold = float(sc["decision_threshold"])
        except Exception:
            pass  # keep defaults

        self._loaded = True


# ──────────────────────────────────────────────────────────────────────────────
# Validation
# ──────────────────────────────────────────────────────────────────────────────

def validate_ensemble_csv(df: pd.DataFrame) -> ValidationResult:
    """
    Check that df contains all required ensemble columns.
    Extra columns are allowed (and ignored).
    Forbidden columns are reported as warnings — they will be stripped.
    """
    headers = set(df.columns)
    missing  = [c for c in ENSEMBLE_COLUMNS if c not in headers]
    forbidden = [c for c in df.columns if c in FORBIDDEN_COLS]

    result = ValidationResult(
        valid=(len(missing) == 0),
        missing=missing,
        forbidden=forbidden,
        row_count=len(df),
    )

    if forbidden:
        result.warnings.append(
            f"Columns {forbidden} will be ignored — they must not be used as "
            "model inputs (data-leakage prevention)."
        )

    if not result.valid:
        return result

    # Per-row numeric checks on the ensemble columns
    bad_rows: dict[int, str] = {}
    for col in ENSEMBLE_COLUMNS:
        if col not in df.columns:
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        non_finite = (~np.isfinite(series.fillna(np.nan))).values
        for idx in np.flatnonzero(non_finite):
            row_i = int(df.index[idx])
            bad_rows[row_i] = bad_rows.get(row_i, "") + f" {col}=non-finite;"

    result.bad_rows = bad_rows
    if bad_rows:
        result.warnings.append(
            f"{len(bad_rows)} row(s) contain non-finite values and will be skipped."
        )

    return result


# ──────────────────────────────────────────────────────────────────────────────
# Internal: extract model-specific feature matrix
# ──────────────────────────────────────────────────────────────────────────────

def _extract_primary(df: pd.DataFrame) -> np.ndarray:
    """
    Build the (N, 22) feature matrix for the Primary model.
    Shared columns are read from their prefixed names (pri_*).
    Feature order is exactly PRIMARY_FEATURES.
    """
    rows = []
    for col in PRIMARY_FEATURES:
        ensemble_col = PRIMARY_COL_MAP[col]  # e.g. "pri_bytes_per_packet"
        rows.append(df[ensemble_col].astype(float).values)
    return np.column_stack(rows)


def _extract_secondary(df: pd.DataFrame) -> np.ndarray:
    """
    Build the (N, 12) feature matrix for the Secondary model.
    Shared columns are read from their prefixed names (sec_*).
    Feature order is exactly SECONDARY_FEATURES.
    """
    rows = []
    for col in SECONDARY_FEATURES:
        ensemble_col = SECONDARY_COL_MAP[col]  # e.g. "sec_bytes_per_packet"
        rows.append(df[ensemble_col].astype(float).values)
    return np.column_stack(rows)


# ──────────────────────────────────────────────────────────────────────────────
# Internal: score computation
# ──────────────────────────────────────────────────────────────────────────────

def _primary_hybrid_score(X: np.ndarray, mc: _ModelCache) -> np.ndarray:
    """
    Compute primary hybrid calibrated score for an (N, 22) array.
    hybrid = w1 * LR_cal + w2 * RF_cal
    """
    lr_cal = mc.pri_lr_cal.predict_proba(X)[:, 1]
    rf_cal = mc.pri_rf_cal.predict_proba(X)[:, 1]
    return mc.pri_w1 * lr_cal + mc.pri_w2 * rf_cal


def _secondary_hybrid_score(X: np.ndarray, mc: _ModelCache) -> np.ndarray:
    """
    Compute secondary hybrid calibrated score for an (N, 12) array.
    hybrid = w1 * LR_cal + w2 * RF_cal
    """
    lr_cal = mc.sec_lr_cal.predict_proba(X)[:, 1]
    rf_cal = mc.sec_rf_cal.predict_proba(X)[:, 1]
    return mc.sec_w1 * lr_cal + mc.sec_w2 * rf_cal


# ──────────────────────────────────────────────────────────────────────────────
# Risk assignment
# ──────────────────────────────────────────────────────────────────────────────

def _assign_risk(score: float, cfg: EnsembleConfig) -> str:
    if score >= cfg.risk_high_threshold:
        return "High Risk"
    if score >= cfg.risk_moderate_threshold:
        return "Moderate Risk"
    return "Low Risk"


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def run_ensemble(
    df_input: pd.DataFrame,
    config: EnsembleConfig | None = None,
) -> EnsembleResult:
    """
    Run the weighted ensemble on a validated DataFrame.

    Parameters
    ----------
    df_input : pd.DataFrame
        Must contain all 34 ENSEMBLE_COLUMNS (extra columns allowed).
    config   : EnsembleConfig, optional
        Weights, threshold, and risk thresholds.  Defaults to EnsembleConfig().

    Returns
    -------
    EnsembleResult
    """
    import time
    t0 = time.perf_counter()

    if config is None:
        config = EnsembleConfig()

    # Strip forbidden columns silently
    usable = df_input.drop(
        columns=[c for c in df_input.columns if c in FORBIDDEN_COLS],
        errors="ignore"
    ).copy()

    # Validate
    vr = validate_ensemble_csv(usable)
    if not vr.valid:
        raise ValueError(
            f"CSV is missing required columns: {vr.missing}\n"
            "Run generate_template() to get a valid template."
        )

    # Drop bad rows
    bad_idx = set(vr.bad_rows.keys())
    clean   = usable.drop(index=list(bad_idx)).reset_index(drop=True)
    if len(clean) == 0:
        raise ValueError("No valid rows remain after removing non-finite values.")

    # Load models
    mc = _ModelCache.get()

    # Extract feature matrices
    X_pri = _extract_primary(clean)
    X_sec = _extract_secondary(clean)

    # Compute per-model hybrid scores
    pri_scores = _primary_hybrid_score(X_pri, mc)
    sec_scores = _secondary_hybrid_score(X_sec, mc)

    # Ensemble score
    ens_scores = config.w_primary * pri_scores + config.w_secondary * sec_scores

    # Binary predictions from each model's own threshold
    pri_preds = (pri_scores >= mc.pri_threshold).astype(int)
    sec_preds = (sec_scores >= mc.sec_threshold).astype(int)

    # Final prediction from ensemble threshold
    final_preds = (ens_scores >= config.threshold).astype(int)

    # Build result rows
    result_rows: list[EnsembleRow] = []
    for i in range(len(clean)):
        result_rows.append(EnsembleRow(
            row_index        = i,
            primary_score    = float(round(pri_scores[i],  6)),
            secondary_score  = float(round(sec_scores[i],  6)),
            ensemble_score   = float(round(ens_scores[i],  6)),
            primary_pred     = int(pri_preds[i]),
            secondary_pred   = int(sec_preds[i]),
            final_prediction = "Attack" if final_preds[i] == 1 else "Normal",
            risk_level       = _assign_risk(float(ens_scores[i]), config),
            disagreement     = bool(pri_preds[i] != sec_preds[i]),
        ))

    # Summary
    attacks      = int(np.sum(final_preds))
    disagreements = int(sum(r.disagreement for r in result_rows))
    summary = {
        "total_rows"     : len(result_rows),
        "skipped_rows"   : len(bad_idx),
        "normal_count"   : len(result_rows) - attacks,
        "attack_count"   : attacks,
        "high_risk"      : sum(1 for r in result_rows if r.risk_level == "High Risk"),
        "moderate_risk"  : sum(1 for r in result_rows if r.risk_level == "Moderate Risk"),
        "low_risk"        : sum(1 for r in result_rows if r.risk_level == "Low Risk"),
        "disagreements"  : disagreements,
        "attack_rate_pct": round(attacks / len(result_rows) * 100, 2),
        "w_primary"      : config.w_primary,
        "w_secondary"    : config.w_secondary,
        "threshold"      : config.threshold,
        "pri_threshold"  : mc.pri_threshold,
        "sec_threshold"  : mc.sec_threshold,
    }

    return EnsembleResult(
        config       = config,
        rows         = result_rows,
        summary      = summary,
        errors       = vr.warnings,
        processing_ms= round((time.perf_counter() - t0) * 1000, 1),
    )


def run_ensemble_from_file(
    csv_path: str,
    config: EnsembleConfig | None = None,
) -> EnsembleResult:
    """Convenience wrapper — reads CSV from disk and calls run_ensemble()."""
    df = pd.read_csv(csv_path)
    return run_ensemble(df, config)


def result_to_dataframe(result: EnsembleResult) -> pd.DataFrame:
    """Convert EnsembleResult.rows to a DataFrame for export."""
    return pd.DataFrame([
        {
            "row_index"       : r.row_index,
            "primary_score"   : r.primary_score,
            "secondary_score" : r.secondary_score,
            "ensemble_score"  : r.ensemble_score,
            "primary_pred"    : "Attack" if r.primary_pred  == 1 else "Normal",
            "secondary_pred"  : "Attack" if r.secondary_pred == 1 else "Normal",
            "final_prediction": r.final_prediction,
            "risk_level"      : r.risk_level,
            "disagreement"    : r.disagreement,
        }
        for r in result.rows
    ])


# ──────────────────────────────────────────────────────────────────────────────
# Template generator
# ──────────────────────────────────────────────────────────────────────────────

def generate_template(output_path: str | None = None, n_rows: int = 3) -> pd.DataFrame:
    """
    Generate a blank CSV template with all 34 ensemble columns.
    Fills example rows with typical values so the user can see the expected
    scale for each column.

    The 3 example rows are:
      Row 0 — Normal web-browsing traffic (both models)
      Row 1 — DoS-style attack (both models)
      Row 2 — Brute-force-style attack (both models)
    """
    examples = [
        # Row 0 — Normal traffic
        {
            # Primary-specific
            "proto_ICMP": 0, "proto_TCP": 1, "proto_UDP": 0,
            "iface_ens192": 1, "iface_eth0": 0,
            "src_port_clean": 54321, "dest_port_clean": 443,
            "has_ports": 1, "is_well_known_port": 1, "is_ephemeral_src_port": 1,
            "flow_pkts_toserver": 3, "flow_pkts_toclient": 4,
            "flow_bytes_toserver": 250, "flow_bytes_toclient": 4800,
            "avg_bytes_toserver_per_pkt": 83.3,
            "pkt_asymmetry_ratio": 0.75, "is_weekend": 0,
            # Shared — Primary scale
            "pri_total_packets": 7, "pri_total_bytes": 5050,
            "pri_bytes_per_packet": 721.4,
            "pri_hour_of_day": 14, "pri_day_of_week": 1,
            # Secondary-specific
            "Source Port": 54321, "Destination Port": 443,
            "Total Fwd Packets": 3, "Total Backward Packets": 4,
            "Total Length of Fwd Packets": 120, "Total Length of Bwd Packets": 4800,
            "packet_asymmetry_ratio": 0.75,
            # Shared — Secondary scale
            "sec_total_packets": 7, "sec_total_bytes": 4920,
            "sec_bytes_per_packet": 702.9,
            "sec_hour_of_day": 14, "sec_day_of_week": 1,
        },
        # Row 1 — DoS attack
        {
            "proto_ICMP": 0, "proto_TCP": 1, "proto_UDP": 0,
            "iface_ens192": 1, "iface_eth0": 0,
            "src_port_clean": 52180, "dest_port_clean": 80,
            "has_ports": 1, "is_well_known_port": 1, "is_ephemeral_src_port": 1,
            "flow_pkts_toserver": 2, "flow_pkts_toclient": 1,
            "flow_bytes_toserver": 12, "flow_bytes_toclient": 0,
            "avg_bytes_toserver_per_pkt": 6.0,
            "pkt_asymmetry_ratio": 2.0, "is_weekend": 0,
            "pri_total_packets": 3, "pri_total_bytes": 12,
            "pri_bytes_per_packet": 4.0,
            "pri_hour_of_day": 10, "pri_day_of_week": 4,
            "Source Port": 52180, "Destination Port": 80,
            "Total Fwd Packets": 2, "Total Backward Packets": 1,
            "Total Length of Fwd Packets": 12, "Total Length of Bwd Packets": 0,
            "packet_asymmetry_ratio": 2.0,
            "sec_total_packets": 3, "sec_total_bytes": 12,
            "sec_bytes_per_packet": 4.0,
            "sec_hour_of_day": 10, "sec_day_of_week": 4,
        },
        # Row 2 — Brute-force (FTP)
        {
            "proto_ICMP": 0, "proto_TCP": 1, "proto_UDP": 0,
            "iface_ens192": 1, "iface_eth0": 0,
            "src_port_clean": 61000, "dest_port_clean": 21,
            "has_ports": 1, "is_well_known_port": 1, "is_ephemeral_src_port": 1,
            "flow_pkts_toserver": 6, "flow_pkts_toclient": 5,
            "flow_bytes_toserver": 150, "flow_bytes_toclient": 80,
            "avg_bytes_toserver_per_pkt": 25.0,
            "pkt_asymmetry_ratio": 1.2, "is_weekend": 0,
            "pri_total_packets": 11, "pri_total_bytes": 230,
            "pri_bytes_per_packet": 20.9,
            "pri_hour_of_day": 9, "pri_day_of_week": 3,
            "Source Port": 61000, "Destination Port": 21,
            "Total Fwd Packets": 6, "Total Backward Packets": 5,
            "Total Length of Fwd Packets": 150, "Total Length of Bwd Packets": 80,
            "packet_asymmetry_ratio": 1.2,
            "sec_total_packets": 11, "sec_total_bytes": 230,
            "sec_bytes_per_packet": 20.9,
            "sec_hour_of_day": 9, "sec_day_of_week": 3,
        },
    ]

    df = pd.DataFrame(examples[:n_rows])

    # Ensure all 34 columns are present in a stable order
    for col in ENSEMBLE_COLUMNS:
        if col not in df.columns:
            df[col] = 0.0

    df = df[ENSEMBLE_COLUMNS]

    if output_path:
        df.to_csv(output_path, index=False)
        print(f"Template saved: {output_path}  ({len(df)} example rows, {len(df.columns)} columns)")

    return df


# ──────────────────────────────────────────────────────────────────────────────
# Column documentation
# ──────────────────────────────────────────────────────────────────────────────

COLUMN_DOCS: dict[str, str] = {
    # Primary-specific
    "proto_ICMP"              : "1 if protocol=ICMP, else 0  (one-hot encoded from 'proto')",
    "proto_TCP"               : "1 if protocol=TCP,  else 0",
    "proto_UDP"               : "1 if protocol=UDP,  else 0",
    "iface_ens192"            : "1 if network interface=ens192, else 0  (one-hot)",
    "iface_eth0"              : "1 if network interface=eth0,   else 0",
    "src_port_clean"          : "Source port number; -1 for ICMP flows",
    "dest_port_clean"         : "Destination port; -1 for ICMP",
    "has_ports"               : "1 if TCP or UDP (has real ports), 0 for ICMP",
    "is_well_known_port"      : "1 if destination port in 0–1023",
    "is_ephemeral_src_port"   : "1 if source port > 49152",
    "flow_pkts_toserver"      : "Packets sent from client to server in this Suricata flow",
    "flow_pkts_toclient"      : "Packets sent from server to client",
    "flow_bytes_toserver"     : "Bytes sent client→server (Suricata scale, can be large)",
    "flow_bytes_toclient"     : "Bytes sent server→client",
    "avg_bytes_toserver_per_pkt": "flow_bytes_toserver / flow_pkts_toserver",
    "pkt_asymmetry_ratio"     : "flow_pkts_toserver / flow_pkts_toclient (Primary model)",
    "is_weekend"              : "1 if Saturday or Sunday, 0 otherwise",
    # Primary shared (prefixed)
    "pri_total_packets"       : "Total packets in flow — PRIMARY scale (Suricata, usually 1–10 for alerts)",
    "pri_total_bytes"         : "Total bytes in flow   — PRIMARY scale (can reach tens of thousands)",
    "pri_bytes_per_packet"    : "Bytes/packet          — PRIMARY scale (mean ~46 935 in training data)",
    "pri_hour_of_day"         : "Hour of flow timestamp 0–23 — PRIMARY dataset temporal distribution",
    "pri_day_of_week"         : "Day of week 0=Mon 6=Sun — PRIMARY dataset distribution",
    # Secondary-specific
    "Source Port"             : "Source TCP/UDP port (CIC-IDS-2017 flow statistics)",
    "Destination Port"        : "Destination TCP/UDP port",
    "Total Fwd Packets"       : "Packets sent in the forward direction (client→server)",
    "Total Backward Packets"  : "Packets sent in the backward direction (server→client)",
    "Total Length of Fwd Packets": "Total bytes in forward direction",
    "Total Length of Bwd Packets": "Total bytes in backward direction",
    "packet_asymmetry_ratio"  : "Directional packet imbalance (Secondary model version)",
    # Secondary shared (prefixed)
    "sec_total_packets"       : "Total packets — SECONDARY scale (CIC-IDS-2017, median 4–5)",
    "sec_total_bytes"         : "Total bytes   — SECONDARY scale (attack median ~30, normal ~219)",
    "sec_bytes_per_packet"    : "Bytes/packet  — SECONDARY scale (attack median 6, normal 63)",
    "sec_hour_of_day"         : "Hour 0–12 — SECONDARY dataset temporal distribution (CIC-IDS-2017)",
    "sec_day_of_week"         : "Day 0–4   — SECONDARY (attacks cluster on days 3–4 in CIC-IDS-2017)",
}


def print_schema() -> None:
    """Print the complete 34-column ensemble schema with explanations."""
    print("=" * 72)
    print("ENSEMBLE CSV SCHEMA  — 34 required columns")
    print("=" * 72)
    print(f"{'Column':<40} {'Model':>8}  Description")
    print("-" * 72)
    for col in ENSEMBLE_COLUMNS:
        in_pri = "PRI" if col in PRIMARY_COL_MAP.values() else "   "
        in_sec = "SEC" if col in SECONDARY_COL_MAP.values() else "   "
        model_tag = f"{in_pri}/{in_sec}"
        doc = COLUMN_DOCS.get(col, "")
        print(f"  {col:<38} {model_tag:>8}  {doc[:60]}")


# ──────────────────────────────────────────────────────────────────────────────
# CLI entry-point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Weighted ensemble of Primary + Secondary IDS models."
    )
    sub = parser.add_subparsers(dest="cmd")

    # predict
    pred_p = sub.add_parser("predict", help="Run ensemble on a CSV file.")
    pred_p.add_argument("csv_path", help="Path to input CSV")
    pred_p.add_argument("--w-primary",   type=float, default=0.5)
    pred_p.add_argument("--w-secondary", type=float, default=0.5)
    pred_p.add_argument("--threshold",   type=float, default=0.5)
    pred_p.add_argument("--output", default=None,
                        help="Save predictions CSV to this path")

    # template
    tmpl_p = sub.add_parser("template", help="Generate a CSV template.")
    tmpl_p.add_argument("--output", default="ensemble_template.csv")
    tmpl_p.add_argument("--rows", type=int, default=3)

    # schema
    sub.add_parser("schema", help="Print the 34-column schema.")

    args = parser.parse_args()

    if args.cmd == "predict":
        cfg = EnsembleConfig(
            w_primary=args.w_primary,
            w_secondary=args.w_secondary,
            threshold=args.threshold,
        )
        result = run_ensemble_from_file(args.csv_path, cfg)
        print(f"\nProcessed {result.summary['total_rows']} rows in {result.processing_ms} ms")
        print(f"  Normal:       {result.summary['normal_count']}")
        print(f"  Attack:       {result.summary['attack_count']}")
        print(f"  High Risk:    {result.summary['high_risk']}")
        print(f"  Moderate:     {result.summary['moderate_risk']}")
        print(f"  Low Risk:     {result.summary['low_risk']}")
        print(f"  Disagreements:{result.summary['disagreements']}")
        if result.errors:
            print("\nWarnings:")
            for w in result.errors:
                print(f"  {w}")
        if args.output:
            df_out = result_to_dataframe(result)
            df_out.to_csv(args.output, index=False)
            print(f"\nPredictions saved: {args.output}")

    elif args.cmd == "template":
        generate_template(args.output, args.rows)

    elif args.cmd == "schema":
        print_schema()

    else:
        parser.print_help()
