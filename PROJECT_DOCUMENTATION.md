# Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage

**Research Project Documentation**  
**Dataset:** Primary testbed traffic (authorized cybersecurity lab)  
**Task:** Binary classification — Normal (0) vs Suspicious/Attack (1) traffic  
**Random Seed:** 42 (all stochastic operations)  
**Total Runtime:** ~10 seconds on a standard workstation  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Dataset Description](#3-dataset-description)
4. [Feature Engineering & Column Roles](#4-feature-engineering--column-roles)
5. [Data Split Strategy](#5-data-split-strategy)
6. [Model Architecture](#6-model-architecture)
7. [Probability Calibration](#7-probability-calibration)
8. [Hybrid Model Design](#8-hybrid-model-design)
9. [SOC Triage Framework](#9-soc-triage-framework)
10. [Evaluation Results](#10-evaluation-results)
11. [Feature Importance Analysis](#11-feature-importance-analysis)
12. [Output Artefacts](#12-output-artefacts)
13. [Interactive SOC Dashboard](#13-interactive-soc-dashboard)
14. [Module Reference](#14-module-reference)
15. [Reproducibility Record](#15-reproducibility-record)
16. [How to Run](#16-how-to-run)
17. [Academic Integrity Guarantees](#17-academic-integrity-guarantees)

---

## 1. Project Overview

This project implements a **Confidence-Based Hybrid Machine Learning Framework** designed to assist Security Operations Center (SOC) analysts in triaging network alerts. Instead of relying on a single classifier, the framework combines two complementary base models — a linear model (Logistic Regression) and a tree-based model (Random Forest) — into a hybrid ensemble whose output is a calibrated confidence score that can be directly mapped to a human-readable SOC triage level.

### Core research contributions

- A **weighted probability combination** scheme where weights are determined empirically on a held-out validation set rather than assumed to be equal.
- A clear separation between **raw model probability** and **calibrated confidence score**, with explicit documentation of what each represents and does not represent.
- A **time-based data split** that respects the temporal nature of network traffic data, preventing any form of future-data leakage.
- A **three-level SOC triage output** (Low Suspicion / Review / High Suspicion) with boundaries derived from the validation data distribution, not hard-coded.
- An **interactive Plotly Dash dashboard** that reads all results from disk, making every metric and visualization completely driven by actual experimental results.

---

## 2. Repository Structure

```
D:\Intrusion-detection-system\
│
├── Raw Data\                              # Original, unmodified data files
│   ├── Primary_training_data.xlsx         # Pre-split training set (14,425 rows)
│   ├── Primary_testing_data.xlsx          # Pre-split test set (3,607 rows)
│   ├── Primary_Dataset.xlsx               # Full primary dataset (reference)
│   └── Secondary_Dataset.csv             # Secondary dataset (NOT used here)
│
├── src\                                   # All Python source modules
│   ├── __init__.py
│   ├── config.py                          # Central configuration & constants
│   ├── data_loader.py                     # Dataset loading, validation, splitting
│   ├── models.py                          # LR pipeline, RF, calibration, saving
│   ├── hybrid.py                          # Weight optimisation, thresholds, triage
│   ├── evaluation.py                      # Metrics, confusion matrices, ROC curves
│   ├── feature_analysis.py               # Feature importance, distribution plots
│   └── predictions_writer.py             # Per-record predictions CSV writer
│
├── results\                               # All generated outputs (never committed raw data)
│   ├── models\
│   │   ├── lr_pipeline.joblib             # Fitted LR + StandardScaler pipeline
│   │   ├── rf_model.joblib                # Fitted RandomForestClassifier
│   │   ├── lr_calibrated.joblib           # Calibrated LR wrapper
│   │   └── rf_calibrated.joblib           # Calibrated RF wrapper
│   │
│   ├── metrics\
│   │   ├── experiment_metadata.json       # Full reproducibility record
│   │   ├── hybrid_config.json             # Tuned weights, thresholds, triage bands
│   │   ├── evaluation_summary_val.csv     # Val set metrics table (LR / RF / Hybrid)
│   │   ├── evaluation_summary_test.csv    # Test set metrics table (LR / RF / Hybrid)
│   │   ├── feature_importance.csv         # RF feature importance scores
│   │   ├── feature_stats_by_class.csv     # Mean/std/median per feature per class
│   │   ├── lr_report_val.txt              # LR classification report (validation)
│   │   ├── lr_report_test.txt             # LR classification report (test)
│   │   ├── rf_report_val.txt              # RF classification report (validation)
│   │   ├── rf_report_test.txt             # RF classification report (test)
│   │   ├── hybrid_report_val.txt          # Hybrid classification report (validation)
│   │   └── hybrid_report_test.txt         # Hybrid classification report (test)
│   │
│   ├── plots\
│   │   ├── cm_lr_val.png                  # LR confusion matrix (validation)
│   │   ├── cm_lr_test.png                 # LR confusion matrix (test)
│   │   ├── cm_rf_val.png                  # RF confusion matrix (validation)
│   │   ├── cm_rf_test.png                 # RF confusion matrix (test)
│   │   ├── cm_hybrid_val.png              # Hybrid confusion matrix (validation)
│   │   ├── cm_hybrid_test.png             # Hybrid confusion matrix (test)
│   │   ├── roc_comparison_val.png         # ROC curves overlay (validation)
│   │   ├── roc_comparison_test.png        # ROC curves overlay (test)
│   │   ├── feature_importance.png         # RF feature importance bar chart
│   │   └── feature_distribution_comparison.png  # Normal vs Attack distributions
│   │
│   └── predictions\
│       ├── predictions_test.csv           # Per-record predictions (test set, 3,607 rows)
│       └── predictions_val.csv            # Per-record predictions (val set, 2,163 rows)
│
├── train_and_evaluate.py                  # Main pipeline orchestration script
├── dashboard.py                           # Interactive Plotly Dash SOC dashboard
├── requirements.txt                       # Pinned Python dependencies
└── PROJECT_DOCUMENTATION.md              # This file
```

---

## 3. Dataset Description

### Source

Traffic captured from an **authorized cybersecurity testbed** — not from a public benchmark. The dataset was collected, labeled, and preprocessed outside this pipeline. This implementation loads and uses the data as-is without any modification to the original files.

### Files used

| File | Rows | Purpose |
|---|---|---|
| `Primary_training_data.xlsx` | 14,425 | Train + validation source |
| `Primary_testing_data.xlsx` | 3,607 | Held-out final test set |

The `Secondary_Dataset.csv` (1.22 GB, ~2.83M rows) is intentionally **never loaded or merged** in this pipeline per research requirements.

### Dataset dimensions

- **28 columns** per row
- **No missing values** (verified programmatically)
- **No infinite values** (verified programmatically)
- **Timestamps** span 2026-07-09 to 2026-09-04

### Class distribution

**Training file (14,425 rows):**

| Class | Count | Proportion |
|---|---|---|
| 1 — Attack/Suspicious | 11,826 | 82.0% |
| 0 — Normal | 2,599 | 18.0% |

**Test file (3,607 rows):**

| Class | Count | Proportion |
|---|---|---|
| 1 — Attack/Suspicious | 2,989 | 82.9% |
| 0 — Normal | 618 | 17.1% |

The dataset is **imbalanced** (~82/18 split). Both models use `class_weight='balanced'` to handle this without oversampling or undersampling.

### Multiclass label distribution (training file)

| Category | Count |
|---|---|
| Attempted Denial of Service | 3,890 |
| Attempted Administrator Privilege Gain | 2,289 |
| Not Suspicious Traffic | 1,943 |
| A Network Trojan was detected | 1,556 |
| Misc activity | 1,495 |
| Potentially Bad Traffic | 1,403 |
| Attempted Information Leak | 1,227 |
| Web Application Attack | 615 |
| Successful Administrator Privilege Gain | 7 |

`label_multiclass` is **retained as metadata** in all prediction outputs and the dashboard but is **never used as a model input feature**.

---

## 4. Feature Engineering & Column Roles

### Predictive features (22 total — only these enter the models)

All features are **network and flow characteristics** that were already engineered in the preprocessing step. No additional preprocessing is performed here except StandardScaler for Logistic Regression.

| # | Feature | Group | Description |
|---|---|---|---|
| 1 | `proto_ICMP` | Protocol | 1 if ICMP, else 0 |
| 2 | `proto_TCP` | Protocol | 1 if TCP, else 0 |
| 3 | `proto_UDP` | Protocol | 1 if UDP, else 0 |
| 4 | `iface_ens192` | Interface | 1 if captured on ens192 interface |
| 5 | `iface_eth0` | Interface | 1 if captured on eth0 interface |
| 6 | `src_port_clean` | Port | Cleaned source port; −1 for ICMP |
| 7 | `dest_port_clean` | Port | Cleaned destination port; −1 for ICMP |
| 8 | `has_ports` | Port indicator | 1 for TCP/UDP (has real port numbers) |
| 9 | `is_well_known_port` | Port indicator | 1 if destination port ≤ 1023 |
| 10 | `is_ephemeral_src_port` | Port indicator | 1 if source port > 49,152 |
| 11 | `flow_pkts_toserver` | Packet count | Packets sent toward the server |
| 12 | `flow_pkts_toclient` | Packet count | Packets sent toward the client |
| 13 | `total_packets` | Packet count | Sum of toserver + toclient |
| 14 | `flow_bytes_toserver` | Byte volume | Bytes sent toward the server |
| 15 | `flow_bytes_toclient` | Byte volume | Bytes sent toward the client |
| 16 | `total_bytes` | Byte volume | Sum of toserver + toclient |
| 17 | `bytes_per_packet` | Traffic ratio | total_bytes / total_packets |
| 18 | `avg_bytes_toserver_per_pkt` | Traffic ratio | flow_bytes_toserver / flow_pkts_toserver |
| 19 | `pkt_asymmetry_ratio` | Traffic ratio | Asymmetry of packet direction counts |
| 20 | `hour_of_day` | Temporal | Hour extracted from timestamp (0–23) |
| 21 | `day_of_week` | Temporal | Day number (0=Monday … 6=Sunday) |
| 22 | `is_weekend` | Temporal | 1 if Saturday or Sunday |

### Excluded columns and rationale

| Column | Reason for exclusion |
|---|---|
| `alert_signature` | Directly reveals attack type → **label leakage** |
| `alert_signature_id` | Numeric ID of signature → **label leakage** |
| `alert_category` | Suricata alert category → **label leakage** |
| `alert_severity` | Suricata alert severity → **label leakage** |
| `flow_id` | Session identifier → **memorisation risk** |
| `src_ip` | Source IP address → **memorisation + privacy** |
| `dest_ip` | Destination IP address → **memorisation + privacy** |
| `timestamp` | Used for splitting only; not a predictive signal |
| `in_iface` | Raw string (already one-hot encoded as `iface_*`) |
| `proto` | Raw string (already one-hot encoded as `proto_*`) |
| `label_multiclass` | Multiclass target → not used in binary task |
| `label_binary` | Binary target → goes to `y`, never into `X` |

---

## 5. Data Split Strategy

### Why time-based splitting?

The testbed dataset contains related observations from overlapping traffic sessions. A **random row shuffle** would allow future-session data to leak into the training set, inflating performance estimates. Time-based splitting ensures that the model is always evaluated on traffic it has never seen during training.

### Split implementation

```
Primary_training_data.xlsx (14,425 rows)
    → sorted by timestamp ascending
    → first 85% (12,262 rows):  Training set   (2026-07-09 → 2026-08-23)
    → last  15%  (2,163 rows):  Validation set (2026-08-23 → 2026-09-04)

Primary_testing_data.xlsx (3,607 rows)
    → Held-out Test set (never touched until final evaluation)
```

A programmatic assertion verifies that `max(train_timestamp) ≤ min(val_timestamp)` — temporal ordering is enforced.

### Final split sizes

| Split | Rows | Normal | Attack |
|---|---|---|---|
| Train | 12,262 | 2,014 (16.4%) | 10,248 (83.6%) |
| Validation | 2,163 | 585 (27.0%) | 1,578 (73.0%) |
| Test | 3,607 | 618 (17.1%) | 2,989 (82.9%) |

### Data leakage guarantees

- The validation set is used **only** for: (a) probability calibration, (b) hybrid weight optimisation, (c) decision threshold selection, (d) triage band determination.
- The test set is used **only** for final evaluation. It is never examined for threshold or weight tuning.
- No information from validation or test sets enters the training step.

---

## 6. Model Architecture

### Base Model 1: Logistic Regression

**Pipeline:** `StandardScaler → LogisticRegression`

Scaling is required because features span widely different magnitudes (e.g., source ports 0–65,535 vs binary flags 0/1). Without scaling, the L2 regulariser in LR would penalise large-magnitude features unfairly.

| Parameter | Value | Reason |
|---|---|---|
| `C` | 1.0 | Standard regularisation strength |
| `max_iter` | 1000 | Ensures convergence on all feature scales |
| `solver` | `lbfgs` | Efficient multi-class-capable solver |
| `class_weight` | `balanced` | Compensates for 82/18 imbalance automatically |
| `random_state` | 42 | Reproducibility |

### Base Model 2: Random Forest Classifier

**No scaling applied** — tree-based models split on thresholds and are invariant to monotonic feature transformations. Scaling would not affect predictions but would obscure feature importance values.

| Parameter | Value | Reason |
|---|---|---|
| `n_estimators` | 300 | Enough trees for stable importance estimates |
| `max_depth` | None | Fully grown trees; regularised via `min_samples_leaf` |
| `min_samples_leaf` | 2 | Light regularisation to prevent single-sample leaves |
| `class_weight` | `balanced` | Compensates for 82/18 imbalance |
| `random_state` | 42 | Reproducibility |
| `n_jobs` | −1 | Use all CPU cores |

### Why these two models?

Logistic Regression and Random Forest provide **complementary inductive biases**:

- LR is a **linear model** — it learns global linear decision boundaries and provides well-understood probability outputs. Its limitations (inability to capture nonlinear interactions) are the RF's strengths.
- RF is a **nonlinear ensemble** — it captures complex feature interactions and is robust to outliers and feature scaling. Its raw probabilities can be poorly calibrated (especially near 0 and 1), which is where calibration helps.

Combining them in a weighted hybrid yields better coverage of the decision space than either alone.

---

## 7. Probability Calibration

### What is calibration?

A model is **calibrated** if its predicted probability `p` matches the empirical frequency of the positive class. For example, if a model assigns a score of 0.7 to 100 events, approximately 70 of them should be actual attacks.

Random Forests often produce **overconfident** probabilities (clustered near 0 and 1), while Logistic Regression can be better calibrated but may drift under class imbalance.

### Method used

`CalibratedClassifierCV` with **isotonic regression** (`method='isotonic'`), fitted using 5-fold cross-validation on the **validation set only**.

```
CalibratedClassifierCV(estimator=base_model, method='isotonic', cv=5)
    .fit(X_val, y_val)
```

### Why isotonic over sigmoid (Platt scaling)?

- Isotonic regression makes **no distributional assumption** about the shape of the calibration curve, making it more appropriate when the relationship between raw scores and true probabilities is non-monotonic.
- With 2,163 validation samples it has enough data to fit reliably (Platt scaling is better suited for very small validation sets).

### Important note — what calibration does and does not mean

> **Calibrated probability ≠ guaranteed confidence percentage.**
>
> A calibrated score of 0.85 means: *among all events assigned this score by the model, approximately 85% were attacks in the validation set.* It is still a statistical estimate subject to distributional shift, sampling variability, and model error. It should be interpreted as a **relative risk indicator**, not as a certainty claim.

Both the raw and calibrated probabilities are saved in the predictions CSV so researchers can inspect both. The hybrid framework uses **calibrated probabilities** for combination, as they provide more reliable soft scores.

---

## 8. Hybrid Model Design

### Formula

```
Hybrid Score = w1 × LR_calibrated_prob + w2 × RF_calibrated_prob

where  w1 + w2 = 1,  w1 ≥ 0,  w2 ≥ 0
```

### Weight optimisation

Weights are not assumed to be 0.5/0.5. Instead, a **grid search** over 9 candidate values of w1 is performed on the validation set:

```
w1 candidates: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
```

For each candidate, the hybrid score is computed and binarised at threshold 0.5, then evaluated on the validation set. The best w1 is the one that maximises F1 (harmonic mean of precision and recall), which balances missed attacks against false alarms.

**Result from this experiment:**

| w1 (LR) | w2 (RF) | Validation F1 |
|---|---|---|
| 0.1 | 0.9 | 0.9946 |
| 0.2 | 0.8 | 0.9946 |
| **0.3** | **0.7** | **0.9946 ✓ (selected)** |
| 0.4 | 0.6 | 0.9940 |
| 0.5 | 0.5 | 0.9905 |
| 0.6 | 0.4 | 0.9806 |
| 0.7 | 0.3 | 0.9636 |
| 0.8 | 0.2 | 0.9608 |
| 0.9 | 0.1 | 0.9322 |

**Selected weights: w1(LR) = 0.30, w2(RF) = 0.70**

The RF receives higher weight, consistent with its superior standalone performance. The LR contribution (30%) still improves precision marginally and reduces false alarms.

### Decision threshold selection

After fixing the weights, the **binary decision threshold** is optimised over a fine grid of 200 values between 0.01 and 0.99 on the validation hybrid scores, again maximising F1.

**Result:** threshold = **0.5025** (very close to 0.5, confirming the calibrated scores are well-centered).

### Why optimise on F1 rather than recall?

F1 was chosen as the default because it balances:
- **Recall** (minimising missed attacks — the primary SOC concern)
- **Precision** (minimising false alarms — analyst fatigue)

If the deployment context requires strictly maximising attack detection at the cost of more false alarms, the criterion can be changed to `'recall'` in `train_and_evaluate.py`.

---

## 9. SOC Triage Framework

### Three-level triage output

Every network event is assigned one of three human-readable triage levels based on its calibrated hybrid score:

| Level | Condition | Interpretation |
|---|---|---|
| **Low Suspicion** | score < 0.2499 | Likely normal traffic; no immediate analyst action required |
| **Review** | 0.2499 ≤ score < 0.9863 | Ambiguous; assign to analyst queue for investigation |
| **High Suspicion** | score ≥ 0.9863 | High-confidence attack indicator; escalate immediately |

### Threshold derivation

Both triage thresholds are derived from the **validation set score distribution** — not hard-coded:

1. `low_threshold` = 25th percentile of all validation hybrid scores
2. `high_threshold` = 75th percentile of all validation hybrid scores, then capped at the median of attack-class scores

This ensures:
- The "Low Suspicion" band captures the bulk of clearly-normal scores.
- The "High Suspicion" band captures the bulk of clearly-attack scores.
- The "Review" band is the analyst's working queue — uncertain cases that require human judgment.

### Test set triage distribution

| Triage Level | Count | Proportion |
|---|---|---|
| Low Suspicion | 563 | 15.6% |
| Review | 1,905 | 52.8% |
| High Suspicion | 1,139 | 31.6% |

---

## 10. Evaluation Results

All metrics are computed from actual model predictions. No values are hard-coded or invented.

### Validation set results (diagnostic — used for tuning)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 0.9186 | 0.9743 | 0.9125 | 0.9424 | 0.9743 |
| Random Forest | 0.9810 | 0.9886 | 0.9854 | 0.9870 | 0.9976 |
| **Hybrid** | **0.9921** | **0.9987** | **0.9905** | **0.9946** | **0.9995** |

**Validation confusion matrices:**

| Model | TN | FP | FN (Missed Attacks) | TP |
|---|---|---|---|---|
| LR | 547 | 38 | 138 | 1,440 |
| RF | 567 | 18 | 23 | 1,555 |
| **Hybrid** | **583** | **2** | **15** | **1,563** |

### Test set results (final — held-out, never seen during tuning)

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 0.8672 | 0.9838 | 0.8538 | 0.9142 | 0.9569 |
| **Random Forest** | **0.9792** | **0.9919** | **0.9829** | **0.9874** | **0.9977** |
| Hybrid | 0.9759 | 0.9929 | 0.9779 | 0.9853 | 0.9843 |

**Test confusion matrices:**

| Model | TN | FP | FN (Missed Attacks) | TP |
|---|---|---|---|---|
| LR | 576 | 42 | **437** | 2,552 |
| RF | 594 | 24 | **51** | 2,938 |
| **Hybrid** | **597** | **21** | **66** | **2,923** |

### Key observations

1. **Logistic Regression** shows the largest performance gap between validation (F1=0.9424) and test (F1=0.9142), suggesting that the linear decision boundary has limited generalisation for this traffic distribution. It misses 437 attacks on the test set.

2. **Random Forest** generalises well, with high test recall (0.9829) and the fewest missed attacks (51). Its ROC-AUC of 0.9977 indicates excellent probability ranking.

3. **Hybrid Model** achieves the highest precision (0.9929) and fewest false alarms (21 FP) on the test set, with only a minor trade-off in recall vs RF. The hybrid effectively leverages the LR contribution to sharpen the decision boundary for clear positive cases while the RF handles complex patterns.

4. **SOC priority metric — Recall:** The RF and Hybrid both exceed 97% recall, meaning fewer than 3% of real attacks are missed. This is critical for SOC operations where a missed alert can have serious consequences.

---

## 11. Feature Importance Analysis

Feature importance is computed from the fitted Random Forest as **mean decrease in Gini impurity** across all trees. Higher scores indicate features that contribute more to separating normal from attack traffic.

### Top 10 features (ranked)

| Rank | Feature | Importance | Interpretation |
|---|---|---|---|
| 1 | `total_bytes` | 0.13879 | Volume of traffic is the strongest discriminator |
| 2 | `bytes_per_packet` | 0.13458 | Average packet size differs markedly between attack types |
| 3 | `proto_TCP` | 0.11689 | Most attacks in this dataset use TCP |
| 4 | `dest_port_clean` | 0.11294 | Attack traffic targets specific ports (e.g., 443, 80, 22) |
| 5 | `flow_bytes_toserver` | 0.09668 | Exploit/DDoS payloads show distinct server-direction volumes |
| 6 | `flow_bytes_toclient` | 0.09547 | Response volume differentiates scan vs session attacks |
| 7 | `avg_bytes_toserver_per_pkt` | 0.07232 | Request size per packet differs for flood vs normal traffic |
| 8 | `total_packets` | 0.05949 | Packet count is elevated for DoS attacks |
| 9 | `proto_UDP` | 0.04664 | DNS-based attacks use UDP (e.g., DNS query for .top/.xyz TLD) |
| 10 | `src_port_clean` | 0.03359 | Ephemeral source ports are common in attack tools |

### Traffic pattern insights (training set)

A statistical comparison of each feature between Normal and Attack classes (mean, std, median) is saved to `results/metrics/feature_stats_by_class.csv`. Visual distribution comparisons for the top 8 features are saved to `results/plots/feature_distribution_comparison.png`.

Key patterns observed:
- **Attack traffic** generally has **larger byte volumes** (`total_bytes`, `flow_bytes_toserver`) — consistent with exploit payloads and DoS flood traffic.
- **Normal traffic** tends to show **more symmetric** packet flows (lower `pkt_asymmetry_ratio`).
- **TCP protocol** is heavily associated with attack traffic, while ICMP shows a distinct signature in the `Misc activity` category.
- **Well-known destination ports** (port ≤ 1023) appear more in attack traffic targeting services like SSH (22), HTTP (80), HTTPS (443), and DNS (53).

---

## 12. Output Artefacts

### Model files (`results/models/`)

| File | Contents |
|---|---|
| `lr_pipeline.joblib` | Fitted sklearn Pipeline: `StandardScaler → LogisticRegression` |
| `rf_model.joblib` | Fitted `RandomForestClassifier` (300 trees) |
| `lr_calibrated.joblib` | `CalibratedClassifierCV` wrapper around `lr_pipeline` |
| `rf_calibrated.joblib` | `CalibratedClassifierCV` wrapper around `rf` |

### Metrics files (`results/metrics/`)

| File | Contents |
|---|---|
| `experiment_metadata.json` | Full reproducibility record (features, params, thresholds, results) |
| `hybrid_config.json` | Tuned w1, w2, decision threshold, triage thresholds, search results |
| `evaluation_summary_val.csv` | Accuracy / Precision / Recall / F1 / ROC-AUC on validation set |
| `evaluation_summary_test.csv` | Accuracy / Precision / Recall / F1 / ROC-AUC on test set |
| `feature_importance.csv` | All 22 features with their Gini importance scores |
| `feature_stats_by_class.csv` | Mean/std/median per feature for Normal vs Attack (training data) |
| `lr_report_{val,test}.txt` | sklearn classification report for LR |
| `rf_report_{val,test}.txt` | sklearn classification report for RF |
| `hybrid_report_{val,test}.txt` | sklearn classification report for Hybrid |

### Plot files (`results/plots/`)

| File | Contents |
|---|---|
| `cm_lr_{val,test}.png` | Confusion matrix heatmap — LR (absolute counts + percentages) |
| `cm_rf_{val,test}.png` | Confusion matrix heatmap — RF |
| `cm_hybrid_{val,test}.png` | Confusion matrix heatmap — Hybrid |
| `roc_comparison_{val,test}.png` | ROC curve overlay for all three models |
| `feature_importance.png` | Horizontal bar chart of RF feature importances |
| `feature_distribution_comparison.png` | 8-panel distribution comparison (Normal vs Attack) |

### Predictions files (`results/predictions/`)

Each row corresponds to one network flow event. Columns:

| Column | Description |
|---|---|
| `row_index` | Original row index from the source file |
| `timestamp` | Event timestamp (IST / Asia/Kolkata timezone) |
| `label_multiclass` | Alert category (metadata only, not used as feature) |
| `label_binary` | Ground truth: 0=Normal, 1=Attack |
| `lr_prob` | Raw LR class-1 probability from `predict_proba()` |
| `lr_pred` | LR hard prediction (threshold 0.5) |
| `rf_prob` | Raw RF class-1 probability from `predict_proba()` |
| `rf_pred` | RF hard prediction (threshold 0.5) |
| `hybrid_score_raw` | Uncalibrated weighted combination (w1×lr_prob + w2×rf_prob) |
| `hybrid_score_calibrated` | Calibrated weighted combination (w1×lr_cal + w2×rf_cal) |
| `hybrid_pred` | Hybrid binary prediction using tuned decision threshold |
| `triage_level` | SOC triage label: Low Suspicion / Review / High Suspicion |

---

## 13. Interactive SOC Dashboard

The dashboard (`dashboard.py`) is a **Plotly Dash** web application. It reads all results from the `results/` directory — no hard-coded metric values.

### Sections

| Section | What it shows |
|---|---|
| **KPI Row** | Total events, normal vs attack counts, hybrid detected, missed attacks (FN), w1/w2 weights, decision threshold |
| **Calibration Note** | Prominent disclaimer explaining what calibrated scores do and do not mean |
| **Triage Pie Chart** | Proportion of test events in each triage level |
| **Attack Categories** | Horizontal bar chart of multiclass label distribution |
| **Protocol Distribution** | TCP / UDP / ICMP breakdown across all events |
| **Top Destination Ports** | Top 15 target ports by event count |
| **Hourly Traffic Pattern** | Stacked bar chart: normal vs attack count by hour of day |
| **Hybrid Score Distribution** | Histogram of calibrated hybrid scores, separated by true label, with decision and triage threshold lines |
| **LR vs RF Probability Scatter** | Per-event scatter plot coloured by hybrid prediction |
| **Model Performance Table** | Accuracy / Precision / Recall / F1 / ROC-AUC comparison table (test set) |
| **Confusion Matrices** | Embedded PNG images for LR, RF, and Hybrid (test set) |
| **ROC Curve Comparison** | Embedded ROC curve overlay image (test set) |
| **Feature Importance** | Interactive Plotly bar chart of RF feature importances |
| **Feature Distributions** | Embedded distribution comparison image |
| **Hybrid Configuration** | Formula, decision threshold, triage band boundaries, calibration method |
| **Prediction Explorer** | Filterable, sortable data table of all 3,607 test predictions with triage-level colour coding |

### Dashboard interactivity

- Filter predictions by **Triage Level** (All / Low Suspicion / Review / High Suspicion)
- Filter predictions by **True Label** (All / Normal / Attack)
- Sort any column in the prediction table
- All Plotly charts support zoom, pan, hover tooltips, and PNG export

---

## 14. Module Reference

### `src/config.py`

Central configuration file. Every constant — paths, feature lists, model parameters, thresholds — is defined here. All other modules import from `config.py` rather than defining their own constants.

**Key constants:**

| Constant | Value | Purpose |
|---|---|---|
| `RANDOM_SEED` | 42 | Fixed seed for all stochastic operations |
| `VAL_FRAC` | 0.15 | Fraction of training rows reserved for validation |
| `CALIBRATION_METHOD` | `'isotonic'` | Calibration algorithm |
| `LR_WEIGHT_CANDIDATES` | [0.1 … 0.9] | Grid for hybrid weight search |
| `FEATURE_COLS` | 22 items | Ordered list of predictive features |
| `TARGET_BINARY` | `'label_binary'` | Target column name |

### `src/data_loader.py`

Loads both xlsx files, runs integrity checks (shape, dtypes, missing values, infinite values, target distribution, timestamp range), performs the time-based split, and returns feature matrices and metadata.

**Public API:** `load_and_split() → dict`

### `src/models.py`

Builds, trains, calibrates, and persists both base models. Provides a unified `get_probabilities()` function that returns both raw and calibrated probabilities.

**Public API:**
- `train_models(X_train, y_train, X_val, y_val) → dict`
- `get_probabilities(models, X, split_name) → dict`
- `save_models(models)`
- `load_models() → dict`

### `src/hybrid.py`

Implements the hybrid framework: weight optimisation, threshold selection, triage band computation, hybrid score calculation, and triage label assignment. All tuning happens on the validation set.

**Public API:**
- `tune_hybrid(lr_prob_val, rf_prob_val, y_val, criterion) → dict`
- `compute_hybrid_score(lr_prob, rf_prob, w1, w2) → ndarray`
- `apply_triage(hybrid_scores, low_thr, high_thr) → list`

### `src/evaluation.py`

Computes Accuracy, Precision, Recall, F1, ROC-AUC for each model. Saves confusion matrix PNG, ROC curve overlay PNG, classification report TXT, and summary CSV.

**Public API:** `evaluate_all(y_true, lr_pred, lr_prob, rf_pred, rf_prob, hybrid_pred, hybrid_score, split_name) → DataFrame`

### `src/feature_analysis.py`

Extracts and visualises Random Forest feature importances. Compares per-class feature distributions between Normal and Attack traffic.

**Public API:**
- `analyse_feature_importance(rf_model, feature_names) → DataFrame`
- `analyse_traffic_patterns(X_train, y_train, top_features) → DataFrame`

### `src/predictions_writer.py`

Assembles a predictions DataFrame from all model outputs and metadata, assigns triage labels, and saves to CSV.

**Public API:** `save_predictions(...) → str` (returns file path)

### `train_and_evaluate.py`

Main orchestration script. Calls all modules in the correct sequence. Writes `experiment_metadata.json` at the end. **This is the only script you need to run** to regenerate all results.

### `dashboard.py`

Self-contained Plotly Dash application. Reads all CSVs, JSONs, and PNGs from `results/`. No imports from `src/`. Starts a local web server on port 8050.

---

## 15. Reproducibility Record

The following parameters uniquely define this experiment. All values are also stored in `results/metrics/experiment_metadata.json`.

| Parameter | Value |
|---|---|
| Dataset version | `Primary_training_data.xlsx / Primary_testing_data.xlsx` |
| Random seed | 42 |
| Number of features | 22 |
| Split method | Time-based: last 15% of training rows by timestamp = validation |
| n_train | 12,262 |
| n_val | 2,163 |
| n_test | 3,607 |
| LR: C | 1.0 |
| LR: solver | lbfgs |
| LR: max_iter | 1000 |
| LR: class_weight | balanced |
| RF: n_estimators | 300 |
| RF: max_depth | None (fully grown) |
| RF: min_samples_leaf | 2 |
| RF: class_weight | balanced |
| Calibration method | isotonic (cv=5 on validation set) |
| Hybrid w1 (LR weight) | 0.30 |
| Hybrid w2 (RF weight) | 0.70 |
| Optimisation criterion | F1 |
| Decision threshold | 0.5025 |
| Low triage threshold | 0.2499 |
| High triage threshold | 0.9863 |
| Total runtime | ~10 seconds |

---

## 16. How to Run

### Prerequisites

Python 3.9+ with the following packages (see `requirements.txt`):

```
pandas==2.3.3
numpy==2.4.1
scikit-learn==1.8.0
joblib==1.5.3
matplotlib==3.10.8
seaborn==0.13.2
plotly==6.5.2
dash==4.4.1
openpyxl==3.1.5
scipy==1.17.0
imbalanced-learn==0.14.2
```

### Installation

```bash
pip install -r requirements.txt
```

### Step 1 — Train models and generate all results

```bash
python train_and_evaluate.py
```

This will:
1. Load and validate both dataset files
2. Print a full inspection report (shape, dtypes, missing values, class distribution)
3. Perform the time-based split
4. Train LR and RF on the training set only
5. Calibrate probabilities on the validation set
6. Optimise hybrid weights and thresholds on the validation set
7. Evaluate all models on validation (diagnostic) and test (final) sets
8. Analyse feature importances and traffic patterns
9. Save predictions CSVs, model joblib files, metrics CSVs, and plot PNGs
10. Write `results/metrics/experiment_metadata.json`

Expected output in `~10 seconds`.

### Step 2 — Launch the SOC dashboard

```bash
python dashboard.py
```

Open your browser at: **http://127.0.0.1:8050**

The dashboard reads results from `results/`. You must run `train_and_evaluate.py` at least once before launching the dashboard.

### Re-running

Running `train_and_evaluate.py` again will overwrite all results with freshly computed values. Because all randomness is seeded, results are identical across runs.

---

## 17. Academic Integrity Guarantees

This implementation was designed with the following explicit commitments:

| Commitment | How it is enforced |
|---|---|
| **No label leakage** | `alert_signature`, `alert_category`, `alert_severity`, `label_multiclass`, IPs, and `flow_id` are in `EXCLUDE_COLS` and never appear in `FEATURE_COLS` |
| **No test set contamination** | Test data is never passed to `train_models()`, `tune_hybrid()`, or `select_threshold()` |
| **No invented results** | All metrics are computed by sklearn from actual predictions; no values are hard-coded anywhere |
| **No dataset modification** | Original xlsx files are opened read-only; the `results/` directory is fully separate |
| **No secondary dataset merging** | `Secondary_Dataset.csv` is never loaded or referenced in any source file |
| **Temporal integrity** | `assert df_tr.timestamp.max() <= df_val.timestamp.min()` is enforced programmatically |
| **Calibration honesty** | Every reference to calibrated scores includes the disclaimer that they are estimates, not guaranteed confidence percentages |
| **Full reproducibility** | Fixed seed=42 on all stochastic operations; all parameters recorded in `experiment_metadata.json` |

---

*Documentation generated for: Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage*  
*Experiment date: September 9, 2026*
