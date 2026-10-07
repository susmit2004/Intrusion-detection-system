"""
config.py
=========
Central configuration for the Confidence-Based Hybrid ML Framework.
All paths, feature lists, model parameters, and reproducibility settings
live here so every other module can import a single source of truth.
"""

import os
from pathlib import Path

# ---------------------------------------------------------------------------
# Reproducibility
# ---------------------------------------------------------------------------
RANDOM_SEED = 42

# ---------------------------------------------------------------------------
# Dataset version tracking
# ---------------------------------------------------------------------------
DATASET_VERSION = "Primary_training_data.xlsx / Primary_testing_data.xlsx"
DATASET_NOTE = (
    "Testbed traffic captured from an authorized cybersecurity lab. "
    "Pre-split train/test files provided; a time-ordered validation split "
    "is carved from the training set inside this pipeline."
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR        = str(Path(__file__).resolve().parents[3])
DATA_DIR        = os.path.join(BASE_DIR, "data", "raw", "primary")
TRAIN_PATH      = os.path.join(DATA_DIR, "Primary_training_data.xlsx")
TEST_PATH       = os.path.join(DATA_DIR, "Primary_testing_data.xlsx")
RESULTS_DIR     = os.path.join(BASE_DIR, "artifacts", "primary")
MODEL_DIR       = os.path.join(RESULTS_DIR, "models")
METRICS_DIR     = os.path.join(RESULTS_DIR, "metrics")
PLOTS_DIR       = os.path.join(RESULTS_DIR, "plots")
PREDICTIONS_DIR = os.path.join(RESULTS_DIR, "predictions")

# ---------------------------------------------------------------------------
# Column roles
# ---------------------------------------------------------------------------

# Raw / meta columns that must NEVER be used as predictive features
# (they cause label leakage or are identifiers)
EXCLUDE_COLS = [
    "alert_signature",       # directly reveals attack type → label leakage
    "alert_signature_id",    # numeric ID of the signature → leakage
    "alert_category",        # suricata alert category → leakage
    "alert_severity",        # suricata alert severity → leakage
    "flow_id",               # session identifier → memorisation risk
    "src_ip",                # source IP → privacy & memorisation risk
    "dest_ip",               # destination IP → privacy & memorisation risk
    "timestamp",             # used for splitting only, not as a feature
    "in_iface",              # raw string interface name (encoded below)
    "proto",                 # raw string protocol name (encoded below)
    "label_multiclass",      # multiclass target → not used in binary task
    "label_binary",          # binary target (goes to y, not X)
]

# Binary target column
TARGET_BINARY = "label_binary"

# Multiclass target (retained for later analysis, never used as feature input)
TARGET_MULTICLASS = "label_multiclass"

# All predictive features used for model training
# These are network / flow characteristics only — no alert metadata.
FEATURE_COLS = [
    # --- Protocol (one-hot encoded, from 'proto') ---
    "proto_ICMP",
    "proto_TCP",
    "proto_UDP",

    # --- Interface (one-hot encoded, from 'in_iface') ---
    "iface_ens192",
    "iface_eth0",

    # --- Port features ---
    "src_port_clean",          # cleaned source port (-1 for ICMP)
    "dest_port_clean",         # cleaned destination port (-1 for ICMP)
    "has_ports",               # 1 if TCP/UDP (has real ports), 0 for ICMP
    "is_well_known_port",      # dest port in 0-1023
    "is_ephemeral_src_port",   # src port > 49152

    # --- Packet count features ---
    "flow_pkts_toserver",      # packets sent to server in the flow
    "flow_pkts_toclient",      # packets sent to client in the flow
    "total_packets",           # total_packets = toserver + toclient

    # --- Byte / volume features ---
    "flow_bytes_toserver",     # bytes sent to server
    "flow_bytes_toclient",     # bytes sent to client
    "total_bytes",             # total_bytes = toserver + toclient

    # --- Derived / engineered traffic ratios ---
    "bytes_per_packet",            # total_bytes / total_packets
    "avg_bytes_toserver_per_pkt",  # flow_bytes_toserver / flow_pkts_toserver
    "pkt_asymmetry_ratio",         # asymmetry of packet counts

    # --- Temporal features ---
    "hour_of_day",   # hour extracted from timestamp (0-23)
    "day_of_week",   # day number (0=Mon … 6=Sun)
    "is_weekend",    # 1 if Saturday or Sunday
]

# ---------------------------------------------------------------------------
# Split settings
# ---------------------------------------------------------------------------
# The provided train/test xlsx files represent a pre-existing temporal split.
# We further carve a validation set from the TRAINING data using the last
# VAL_FRAC fraction sorted by timestamp (time-based, no data leakage).
VAL_FRAC = 0.15   # 15 % of training rows used for validation

# ---------------------------------------------------------------------------
# Model hyper-parameters (fixed for reproducibility)
# ---------------------------------------------------------------------------
LR_PARAMS = {
    "C": 1.0,
    "max_iter": 1000,
    "solver": "lbfgs",
    "class_weight": "balanced",   # handles the 82/18 class imbalance
    "random_state": RANDOM_SEED,
}

RF_PARAMS = {
    "n_estimators": 300,
    "max_depth": None,
    "min_samples_leaf": 2,
    "class_weight": "balanced",   # handles the 82/18 class imbalance
    "random_state": RANDOM_SEED,
    "n_jobs": -1,
}

# ---------------------------------------------------------------------------
# Hybrid model weight search space (grid over val set)
# ---------------------------------------------------------------------------
# w1 = weight for Logistic Regression, w2 = 1 - w1 for Random Forest
LR_WEIGHT_CANDIDATES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]

# ---------------------------------------------------------------------------
# SOC triage level thresholds (determined on validation set, see hybrid.py)
# Three bands: low / review / high — stored here after tuning
# (overwritten by train_and_evaluate.py once computed)
# ---------------------------------------------------------------------------
# Defaults — will be replaced by data-driven values during training
DEFAULT_LOW_THRESHOLD    = 0.35   # hybrid_score < this → Low Suspicion
DEFAULT_HIGH_THRESHOLD   = 0.65   # hybrid_score >= this → High Suspicion
# between LOW and HIGH → Review / Medium Suspicion

# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------
CALIBRATION_METHOD = "isotonic"   # 'sigmoid' (Platt) or 'isotonic'

# ---------------------------------------------------------------------------
# Column names written to the predictions CSV
# ---------------------------------------------------------------------------
PRED_COLS = [
    "row_index",
    "timestamp",
    "label_multiclass",
    "label_binary",
    "lr_prob",
    "lr_pred",
    "rf_prob",
    "rf_pred",
    "hybrid_score_raw",        # uncalibrated weighted combination
    "hybrid_score_calibrated", # after probability calibration
    "hybrid_pred",
    "triage_level",            # Low Suspicion / Review / High Suspicion
]
