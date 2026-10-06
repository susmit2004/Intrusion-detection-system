// ============================================================
// Mock Data — mirrors actual project results from experiment
// artifacts. Replace with real API calls when backend is ready.
// All numbers are from the real experiment_config.json outputs.
// ============================================================

import type {
  ModelConfig,
  ModelMetrics,
  FeatureImportanceItem,
  FeatureStats,
  AttackCategoryItem,
  PredictionRow,
  PredictionSummary,
} from "@/types";

// ── Primary Model metrics (confirmed from evaluation_summary_test.csv) ────────
export const PRIMARY_METRICS: ModelMetrics[] = [
  {
    model_name: "Logistic Regression",
    split: "Test",
    accuracy: 0.8672,
    precision: 0.9838,
    recall: 0.8538,
    f1: 0.9142,
    roc_auc: 0.9569,
    tp: 2552, tn: 576, fp: 42, fn: 437,
  },
  {
    model_name: "Random Forest",
    split: "Test",
    accuracy: 0.9792,
    precision: 0.9919,
    recall: 0.9829,
    f1: 0.9874,
    roc_auc: 0.9977,
    tp: 2938, tn: 594, fp: 24, fn: 51,
  },
  {
    model_name: "Hybrid Model",
    split: "Test",
    accuracy: 0.9759,
    precision: 0.9929,
    recall: 0.9779,
    f1: 0.9853,
    roc_auc: 0.9843,
    tp: 2923, tn: 597, fp: 21, fn: 66,
  },
];

// ── Secondary Model metrics (confirmed from evaluation_summary_test.csv) ─────
export const SECONDARY_METRICS: ModelMetrics[] = [
  {
    model_name: "Logistic Regression",
    split: "Test",
    accuracy: 0.8306,
    precision: 0.5508,
    recall: 0.7685,
    f1: 0.6417,
    roc_auc: 0.8938,
    tp: 4551, tn: 20366, fp: 3712, fn: 1371,
  },
  {
    model_name: "Random Forest",
    split: "Test",
    accuracy: 0.9986,
    precision: 0.9963,
    recall: 0.9966,
    f1: 0.9965,
    roc_auc: 0.9995,
    tp: 5902, tn: 24056, fp: 22, fn: 20,
  },
  {
    model_name: "Hybrid Model",
    split: "Test",
    accuracy: 0.9986,
    precision: 0.9963,
    recall: 0.9966,
    f1: 0.9965,
    roc_auc: 0.9995,
    tp: 5902, tn: 24056, fp: 22, fn: 20,
  },
];

// ── Primary Model config ───────────────────────────────────────────────────
export const PRIMARY_MODEL_CONFIG: ModelConfig = {
  model: "primary",
  label: "Primary Model",
  dataset: "Suricata IDS Testbed (July–Sep 2026)",
  n_features: 22,
  feature_list: [
    "proto_ICMP","proto_TCP","proto_UDP","iface_ens192","iface_eth0",
    "src_port_clean","dest_port_clean","has_ports","is_well_known_port",
    "is_ephemeral_src_port","flow_pkts_toserver","flow_pkts_toclient",
    "total_packets","flow_bytes_toserver","flow_bytes_toclient","total_bytes",
    "bytes_per_packet","avg_bytes_toserver_per_pkt","pkt_asymmetry_ratio",
    "hour_of_day","day_of_week","is_weekend",
  ],
  n_train: 12262, n_val: 2163, n_test: 3607,
  lr_params: { C: 1.0, max_iter: 1000, solver: "lbfgs", class_weight: "balanced" },
  rf_params: { n_estimators: 300, max_depth: null, min_samples_leaf: 2, class_weight: "balanced" },
  hybrid: {
    w_lr: 0.3, w_rf: 0.7,
    decision_threshold: 0.5025,
    low_triage_threshold: 0.2499,
    high_triage_threshold: 0.9863,
    calibration_method: "isotonic",
  },
  metrics: PRIMARY_METRICS,
  runtime_seconds: 9.2,
};

// ── Secondary Model config ──────────────────────────────────────────────────
export const SECONDARY_MODEL_CONFIG: ModelConfig = {
  model: "secondary",
  label: "Secondary Model",
  dataset: "CIC-IDS-2017 (Canadian Institute for Cybersecurity)",
  n_features: 12,
  feature_list: [
    "Source Port","Destination Port","Total Fwd Packets","Total Backward Packets",
    "Total Length of Fwd Packets","Total Length of Bwd Packets",
    "total_packets","total_bytes","bytes_per_packet","packet_asymmetry_ratio",
    "hour_of_day","day_of_week",
  ],
  n_train: 49053, n_val: 10504, n_test: 30000,
  lr_params: { C: 1.0, max_iter: 1000, solver: "lbfgs", class_weight: "balanced" },
  rf_params: { n_estimators: 300, max_depth: null, min_samples_leaf: 2, class_weight: "balanced" },
  hybrid: {
    w_lr: 0.0, w_rf: 1.0,
    decision_threshold: 0.4536,
    low_triage_threshold: 0.0,
    high_triage_threshold: 1.0,
    calibration_method: "isotonic",
  },
  metrics: SECONDARY_METRICS,
  runtime_seconds: 15.3,
};

// ── Secondary RF Feature Importance (from secondary_feature_importance.csv) ──
export const SECONDARY_FEATURE_IMPORTANCE: FeatureImportanceItem[] = [
  { rank: 1,  feature: "Destination Port",            importance: 0.1655 },
  { rank: 2,  feature: "bytes_per_packet",             importance: 0.1577 },
  { rank: 3,  feature: "Total Length of Bwd Packets",  importance: 0.1178 },
  { rank: 4,  feature: "total_bytes",                  importance: 0.1144 },
  { rank: 5,  feature: "day_of_week",                  importance: 0.1141 },
  { rank: 6,  feature: "Total Length of Fwd Packets",  importance: 0.0852 },
  { rank: 7,  feature: "Source Port",                  importance: 0.0852 },
  { rank: 8,  feature: "Total Backward Packets",       importance: 0.0469 },
  { rank: 9,  feature: "hour_of_day",                  importance: 0.0349 },
  { rank: 10, feature: "total_packets",                importance: 0.0278 },
  { rank: 11, feature: "Total Fwd Packets",            importance: 0.0267 },
  { rank: 12, feature: "packet_asymmetry_ratio",       importance: 0.0239 },
];

// ── Primary RF Feature Importance (from feature_importance.csv) ──────────────
export const PRIMARY_FEATURE_IMPORTANCE: FeatureImportanceItem[] = [
  { rank: 1,  feature: "total_bytes",                 importance: 0.1388 },
  { rank: 2,  feature: "bytes_per_packet",            importance: 0.1346 },
  { rank: 3,  feature: "proto_TCP",                   importance: 0.1169 },
  { rank: 4,  feature: "dest_port_clean",             importance: 0.1129 },
  { rank: 5,  feature: "flow_bytes_toserver",         importance: 0.0967 },
  { rank: 6,  feature: "flow_bytes_toclient",         importance: 0.0955 },
  { rank: 7,  feature: "avg_bytes_toserver_per_pkt",  importance: 0.0723 },
  { rank: 8,  feature: "total_packets",               importance: 0.0595 },
  { rank: 9,  feature: "proto_UDP",                   importance: 0.0466 },
  { rank: 10, feature: "src_port_clean",              importance: 0.0336 },
  { rank: 11, feature: "flow_pkts_toserver",          importance: 0.0221 },
  { rank: 12, feature: "is_ephemeral_src_port",       importance: 0.0138 },
];

// ── Feature stats (from secondary_feature_stats_by_class.csv) ────────────────
export const SECONDARY_FEATURE_STATS: FeatureStats[] = [
  { feature: "Source Port",                normal_mean: 39953, normal_median: 51583, normal_std: 24041, attack_mean: 46832, attack_median: 48262, attack_std: 10577 },
  { feature: "Destination Port",           normal_mean: 9280,  normal_median: 80,    normal_std: 19625, attack_mean: 2524,  attack_median: 80,    attack_std: 8154  },
  { feature: "Total Fwd Packets",         normal_mean: 27.5,  normal_median: 2,     normal_std: 1887,  attack_mean: 4.1,   attack_median: 3,     attack_std: 3.8   },
  { feature: "Total Backward Packets",    normal_mean: 35.4,  normal_median: 2,     normal_std: 2578,  attack_mean: 3.3,   attack_median: 1,     attack_std: 3.8   },
  { feature: "Total Length of Fwd Pkts",  normal_mean: 691,   normal_median: 66,    normal_std: 9056,  attack_mean: 173,   attack_median: 26,    attack_std: 563   },
  { feature: "Total Length of Bwd Pkts",  normal_mean: 68966, normal_median: 130,   normal_std: 5612429, attack_mean: 5187, attack_median: 6,  attack_std: 5780  },
  { feature: "total_packets",             normal_mean: 62.9,  normal_median: 4,     normal_std: 4464,  attack_mean: 7.3,   attack_median: 5,     attack_std: 7.1   },
  { feature: "total_bytes",               normal_mean: 69657, normal_median: 219,   normal_std: 5618694, attack_mean: 5359, attack_median: 30, attack_std: 5981  },
  { feature: "bytes_per_packet",          normal_mean: 116.4, normal_median: 63,    normal_std: 194,   attack_mean: 478.1, attack_median: 6,     attack_std: 554   },
  { feature: "packet_asymmetry_ratio",    normal_mean: 1.50,  normal_median: 1.0,   normal_std: 4.53,  attack_mean: 1.56,  attack_median: 1.0,   attack_std: 1.24  },
  { feature: "hour_of_day",              normal_mean: 6.25,  normal_median: 4,     normal_std: 3.93,  attack_mean: 6.26,  attack_median: 4,     attack_std: 3.65  },
  { feature: "day_of_week",              normal_mean: 1.91,  normal_median: 2,     normal_std: 1.42,  attack_mean: 3.02,  attack_median: 4,     attack_std: 1.04  },
];

// ── Secondary attack category breakdown (from training distribution) ──────────
export const SECONDARY_ATTACK_CATEGORIES: AttackCategoryItem[] = [
  { name: "DoS Hulk",               count: 2337, percentage: 39.5 },
  { name: "PortScan",               count: 1718, percentage: 29.0 },
  { name: "DDoS",                   count: 1459, percentage: 24.6 },
  { name: "DoS GoldenEye",          count: 104,  percentage: 1.8  },
  { name: "FTP-Patator",            count: 85,   percentage: 1.4  },
  { name: "DoS slowloris",          count: 60,   percentage: 1.0  },
  { name: "SSH-Patator",            count: 59,   percentage: 1.0  },
  { name: "DoS Slowhttptest",       count: 47,   percentage: 0.8  },
  { name: "Bot",                    count: 24,   percentage: 0.4  },
  { name: "Web Attack–Brute Force", count: 19,   percentage: 0.3  },
  { name: "Web Attack–XSS",         count: 9,    percentage: 0.2  },
];

// ── Primary attack category breakdown ─────────────────────────────────────────
export const PRIMARY_ATTACK_CATEGORIES: AttackCategoryItem[] = [
  { name: "Attempted DoS",                      count: 993, percentage: 33.2 },
  { name: "Attempted Admin Privilege Gain",     count: 572, percentage: 19.1 },
  { name: "Not Suspicious",                     count: 465, percentage: 15.6 },
  { name: "Misc activity",                      count: 362, percentage: 12.1 },
  { name: "Network Trojan Detected",            count: 358, percentage: 12.0 },
  { name: "Potentially Bad Traffic",            count: 353, percentage: 11.8 },
  { name: "Attempted Information Leak",         count: 353, percentage: 11.8 },
  { name: "Web Application Attack",             count: 147, percentage: 4.9  },
];

// ── Mock prediction rows (sample — CIC-IDS-2017 compatible) ───────────────────
export const MOCK_PREDICTION_ROWS: PredictionRow[] = [
  { id: 1,  attack_type: "Normal",       lr_prob_raw: 0.24, rf_prob_raw: 0.00, lr_prob_calibrated: 0.02, rf_prob_calibrated: 0.00, hybrid_score_raw: 0.00, hybrid_score_calibrated: 0.00, prediction: "Normal", risk_level: "Low Risk",      triage_level: "Low Suspicion", true_binary: 0, correct: true  },
  { id: 2,  attack_type: "DoS",          lr_prob_raw: 0.73, rf_prob_raw: 0.97, lr_prob_calibrated: 0.91, rf_prob_calibrated: 0.99, hybrid_score_raw: 0.97, hybrid_score_calibrated: 0.99, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 3,  attack_type: "DDoS",         lr_prob_raw: 0.83, rf_prob_raw: 0.99, lr_prob_calibrated: 0.48, rf_prob_calibrated: 1.00, hybrid_score_raw: 0.99, hybrid_score_calibrated: 1.00, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 4,  attack_type: "PortScan",     lr_prob_raw: 0.54, rf_prob_raw: 1.00, lr_prob_calibrated: 0.15, rf_prob_calibrated: 1.00, hybrid_score_raw: 1.00, hybrid_score_calibrated: 1.00, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 5,  attack_type: "Normal",       lr_prob_raw: 0.09, rf_prob_raw: 0.00, lr_prob_calibrated: 0.01, rf_prob_calibrated: 0.00, hybrid_score_raw: 0.00, hybrid_score_calibrated: 0.00, prediction: "Normal", risk_level: "Low Risk",      triage_level: "Low Suspicion", true_binary: 0, correct: true  },
  { id: 6,  attack_type: "FTP-Patator",  lr_prob_raw: 0.13, rf_prob_raw: 0.98, lr_prob_calibrated: 0.02, rf_prob_calibrated: 0.99, hybrid_score_raw: 0.98, hybrid_score_calibrated: 0.99, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 7,  attack_type: "Normal",       lr_prob_raw: 0.76, rf_prob_raw: 0.01, lr_prob_calibrated: 0.37, rf_prob_calibrated: 0.00, hybrid_score_raw: 0.01, hybrid_score_calibrated: 0.00, prediction: "Normal", risk_level: "Low Risk",      triage_level: "Low Suspicion", true_binary: 0, correct: true  },
  { id: 8,  attack_type: "Bot",          lr_prob_raw: 0.29, rf_prob_raw: 0.39, lr_prob_calibrated: 0.03, rf_prob_calibrated: 0.03, hybrid_score_raw: 0.39, hybrid_score_calibrated: 0.03, prediction: "Normal", risk_level: "Low Risk",      triage_level: "Low Suspicion", true_binary: 1, correct: false },
  { id: 9,  attack_type: "DDoS",         lr_prob_raw: 0.99, rf_prob_raw: 1.00, lr_prob_calibrated: 0.99, rf_prob_calibrated: 1.00, hybrid_score_raw: 1.00, hybrid_score_calibrated: 1.00, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 10, attack_type: "SSH-Patator",  lr_prob_raw: 0.19, rf_prob_raw: 0.99, lr_prob_calibrated: 0.02, rf_prob_calibrated: 1.00, hybrid_score_raw: 0.99, hybrid_score_calibrated: 1.00, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 11, attack_type: "Normal",       lr_prob_raw: 0.11, rf_prob_raw: 0.00, lr_prob_calibrated: 0.01, rf_prob_calibrated: 0.00, hybrid_score_raw: 0.00, hybrid_score_calibrated: 0.00, prediction: "Normal", risk_level: "Low Risk",      triage_level: "Low Suspicion", true_binary: 0, correct: true  },
  { id: 12, attack_type: "Web Attack",   lr_prob_raw: 0.87, rf_prob_raw: 0.99, lr_prob_calibrated: 0.91, rf_prob_calibrated: 0.99, hybrid_score_raw: 0.99, hybrid_score_calibrated: 0.99, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
  { id: 13, attack_type: "DoS slowloris",lr_prob_raw: 0.55, rf_prob_raw: 0.57, lr_prob_calibrated: 0.15, rf_prob_calibrated: 0.66, hybrid_score_raw: 0.57, hybrid_score_calibrated: 0.66, prediction: "Attack", risk_level: "Moderate Risk", triage_level: "Medium / Review",true_binary: 1, correct: true  },
  { id: 14, attack_type: "Normal",       lr_prob_raw: 0.40, rf_prob_raw: 0.13, lr_prob_calibrated: 0.15, rf_prob_calibrated: 0.03, hybrid_score_raw: 0.13, hybrid_score_calibrated: 0.03, prediction: "Normal", risk_level: "Low Risk",      triage_level: "Low Suspicion", true_binary: 0, correct: true  },
  { id: 15, attack_type: "DoS GoldenEye",lr_prob_raw: 0.91, rf_prob_raw: 0.99, lr_prob_calibrated: 0.91, rf_prob_calibrated: 0.99, hybrid_score_raw: 0.99, hybrid_score_calibrated: 0.99, prediction: "Attack", risk_level: "High Risk",     triage_level: "High Suspicion",true_binary: 1, correct: true  },
];

export const MOCK_PREDICTION_SUMMARY: PredictionSummary = {
  total_events: 30000,
  normal_count: 24078,
  attack_count: 5922,
  high_risk: 5279,
  moderate_risk: 571,
  low_risk: 24150,
  attack_rate: 19.74,
  detection_rate: 99.66,
};

// ── Hourly distribution for timeline chart ────────────────────────────────────
export const HOURLY_DISTRIBUTION = Array.from({ length: 13 }, (_, h) => ({
  hour: `${h.toString().padStart(2, "0")}:00`,
  normal: Math.floor(1800 + Math.random() * 400),
  attack: h >= 2 && h <= 4 ? Math.floor(400 + Math.random() * 300) : Math.floor(50 + Math.random() * 100),
}));

// ── Daily distribution ────────────────────────────────────────────────────────
export const DAILY_DISTRIBUTION = [
  { day: "Mon", normal: 3200, attack: 410 },
  { day: "Tue", normal: 3400, attack: 520 },
  { day: "Wed", normal: 3100, attack: 390 },
  { day: "Thu", normal: 2900, attack: 2100 },
  { day: "Fri", normal: 2800, attack: 2802 },
];
