"""
data_loader.py
==============
Loads the pre-prepared primary dataset, validates its integrity,
and performs a TIME-BASED train / validation / test split.

Key design decisions
---------------------
* The provided xlsx files already separate train and test chronologically.
  We honour that split and only carve a validation set from the training
  portion (last VAL_FRAC fraction by timestamp) to avoid any leakage.
* No random row shuffle before splitting.
* label_multiclass is retained as metadata but never added to X.
* alert_signature and other leakage columns are excluded from X.
* The original xlsx files are NEVER modified.
"""

import pandas as pd
import numpy as np
import os

from src.config import (
    TRAIN_PATH, TEST_PATH, FEATURE_COLS,
    TARGET_BINARY, TARGET_MULTICLASS,
    VAL_FRAC, RANDOM_SEED,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_raw(path: str) -> pd.DataFrame:
    """Read an xlsx file and return a DataFrame with timestamp parsed."""
    df = pd.read_excel(path)
    # Parse timestamp but keep it as a column (used for splitting & metadata)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


def _validate_dataframe(df: pd.DataFrame, name: str) -> None:
    """Run basic integrity checks and print a summary report."""
    print(f"\n{'='*60}")
    print(f"  Dataset inspection: {name}")
    print(f"{'='*60}")
    print(f"  Shape              : {df.shape}")
    print(f"  Columns ({len(df.columns)})        : {list(df.columns)}")
    print()

    # Data types
    print("  Data types:")
    for col, dtype in df.dtypes.items():
        print(f"    {col:<35s} {str(dtype)}")
    print()

    # Missing values
    missing = df.isnull().sum()
    missing_nonzero = missing[missing > 0]
    if len(missing_nonzero) == 0:
        print("  Missing values     : None [OK]")
    else:
        print(f"  Missing values     : {missing_nonzero.to_dict()}")

    # Infinite values (numeric only)
    num_cols = df.select_dtypes(include=[np.number]).columns
    inf_counts = np.isinf(df[num_cols]).sum()
    inf_nonzero = inf_counts[inf_counts > 0]
    if len(inf_nonzero) == 0:
        print("  Infinite values    : None [OK]")
    else:
        print(f"  Infinite values    : {inf_nonzero.to_dict()}")

    # Target distribution
    if TARGET_BINARY in df.columns:
        counts = df[TARGET_BINARY].value_counts()
        proportions = df[TARGET_BINARY].value_counts(normalize=True).round(3)
        print(f"\n  {TARGET_BINARY} distribution:")
        for val in counts.index:
            label = "Normal" if val == 0 else "Attack/Suspicious"
            print(f"    {val} ({label:<20s}): {counts[val]:>6d}  ({proportions[val]*100:.1f} %)")

    if TARGET_MULTICLASS in df.columns:
        print(f"\n  {TARGET_MULTICLASS} distribution:")
        for cls, cnt in df[TARGET_MULTICLASS].value_counts().items():
            print(f"    {cls:<45s}: {cnt}")

    # Timestamp range
    if "timestamp" in df.columns:
        print(f"\n  Timestamp range    : {df['timestamp'].min()} -> {df['timestamp'].max()}")

    print()


def _check_features_present(df: pd.DataFrame) -> None:
    """Confirm every feature in FEATURE_COLS exists in the dataframe."""
    missing_feats = [f for f in FEATURE_COLS if f not in df.columns]
    if missing_feats:
        raise ValueError(
            f"The following required feature columns are MISSING from the "
            f"dataset: {missing_feats}\n"
            f"Available columns: {list(df.columns)}"
        )
    print(f"  Feature columns check: all {len(FEATURE_COLS)} features present [OK]")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_and_split() -> dict:
    """
    Load primary dataset and return a dict with these keys:
        X_train, y_train, meta_train  (training split)
        X_val,   y_val,   meta_val    (validation split — carved from training)
        X_test,  y_test,  meta_test   (held-out test split)
        feature_names                 (ordered list of feature column names)

    'meta_*' DataFrames contain: timestamp, label_multiclass, label_binary
    (useful for analysis and predictions CSV, never fed into models).

    Split strategy
    --------------
    1. Load Primary_training_data.xlsx  → sort by timestamp ascending
    2. Validation = last VAL_FRAC rows by time  (no leakage from future)
    3. Training   = remaining earlier rows
    4. Load Primary_testing_data.xlsx   → held-out test set (already separate)
    """

    # ------------------------------------------------------------------
    # 1. Load raw files
    # ------------------------------------------------------------------
    print("\nLoading Primary_training_data.xlsx ...")
    df_train_raw = _load_raw(TRAIN_PATH)

    print("Loading Primary_testing_data.xlsx ...")
    df_test_raw  = _load_raw(TEST_PATH)

    # ------------------------------------------------------------------
    # 2. Validate both files
    # ------------------------------------------------------------------
    _validate_dataframe(df_train_raw, "Primary_training_data.xlsx")
    _validate_dataframe(df_test_raw,  "Primary_testing_data.xlsx")
    _check_features_present(df_train_raw)
    _check_features_present(df_test_raw)

    # ------------------------------------------------------------------
    # 3. Time-based train / validation split from training data
    # ------------------------------------------------------------------
    df_train_raw = df_train_raw.sort_values("timestamp").reset_index(drop=True)

    n_total = len(df_train_raw)
    n_val   = int(np.floor(n_total * VAL_FRAC))
    n_tr    = n_total - n_val

    df_tr  = df_train_raw.iloc[:n_tr].copy()
    df_val = df_train_raw.iloc[n_tr:].copy()

    print(f"\nTime-based Train / Validation split (VAL_FRAC={VAL_FRAC}):")
    print(f"  Training rows   : {len(df_tr):>6d}  "
          f"({df_tr['timestamp'].min().date()} -> {df_tr['timestamp'].max().date()})")
    print(f"  Validation rows : {len(df_val):>6d}  "
          f"({df_val['timestamp'].min().date()} -> {df_val['timestamp'].max().date()})")
    print(f"  Test rows       : {len(df_test_raw):>6d}  "
          f"({df_test_raw['timestamp'].min().date()} -> {df_test_raw['timestamp'].max().date()})")

    # Sanity check: training timestamps must all precede validation timestamps
    assert df_tr["timestamp"].max() <= df_val["timestamp"].min(), (
        "Temporal split violated: training data is not fully before validation data!"
    )
    print("  Temporal ordering check: training <= validation [OK]")

    # ------------------------------------------------------------------
    # 4. Build feature matrices and target vectors
    # ------------------------------------------------------------------
    def _split(df: pd.DataFrame):
        X    = df[FEATURE_COLS].copy().reset_index(drop=True)
        y    = df[TARGET_BINARY].values
        meta = df[["timestamp", TARGET_MULTICLASS, TARGET_BINARY]].copy().reset_index(drop=True)
        # Store original row index from the raw file for traceability
        meta["row_index"] = df.index if "index" not in df.columns else df.index
        return X, y, meta

    X_train, y_train, meta_train = _split(df_tr)
    X_val,   y_val,   meta_val   = _split(df_val)
    X_test,  y_test,  meta_test  = _split(df_test_raw)

    print(f"\nLabel distributions after split:")
    for split_name, y_arr in [("Train", y_train), ("Val", y_val), ("Test", y_test)]:
        total  = len(y_arr)
        n_atk  = y_arr.sum()
        n_norm = total - n_atk
        print(f"  {split_name:<6s}: Normal={n_norm} ({100*n_norm/total:.1f}%)  "
              f"Attack={n_atk} ({100*n_atk/total:.1f}%)")

    return {
        "X_train": X_train,
        "y_train": y_train,
        "meta_train": meta_train,
        "X_val":   X_val,
        "y_val":   y_val,
        "meta_val": meta_val,
        "X_test":  X_test,
        "y_test":  y_test,
        "meta_test": meta_test,
        "feature_names": FEATURE_COLS,
    }
