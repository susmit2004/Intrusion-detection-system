// ============================================================
// Core ML / Domain Types
// ============================================================

export type RiskLevel = "High Risk" | "Moderate Risk" | "Low Risk";
export type PredictionLabel = "Attack" | "Normal";
export type ModelName = "primary" | "secondary";

// 12 CIC-IDS-2017 network-flow features used by the Secondary Model
export interface SecondaryFeatures {
  "Source Port": number;
  "Destination Port": number;
  "Total Fwd Packets": number;
  "Total Backward Packets": number;
  "Total Length of Fwd Packets": number;
  "Total Length of Bwd Packets": number;
  total_packets: number;
  total_bytes: number;
  bytes_per_packet: number;
  packet_asymmetry_ratio: number;
  hour_of_day: number;
  day_of_week: number;
}

// 22 Suricata/testbed network features used by the Primary Model
export interface PrimaryFeatures {
  proto_ICMP: number;
  proto_TCP: number;
  proto_UDP: number;
  iface_ens192: number;
  iface_eth0: number;
  src_port_clean: number;
  dest_port_clean: number;
  has_ports: number;
  is_well_known_port: number;
  is_ephemeral_src_port: number;
  flow_pkts_toserver: number;
  flow_pkts_toclient: number;
  total_packets: number;
  flow_bytes_toserver: number;
  flow_bytes_toclient: number;
  total_bytes: number;
  bytes_per_packet: number;
  avg_bytes_toserver_per_pkt: number;
  pkt_asymmetry_ratio: number;
  hour_of_day: number;
  day_of_week: number;
  is_weekend: number;
}

// ============================================================
// Prediction / Inference Types
// ============================================================

export interface PredictionRow {
  id: number;
  // Reference info (not model inputs)
  attack_type?: string;
  true_label?: string;
  // Model probabilities
  lr_prob_raw: number;
  rf_prob_raw: number;
  lr_prob_calibrated: number;
  rf_prob_calibrated: number;
  // Hybrid
  hybrid_score_raw: number;
  hybrid_score_calibrated: number;
  // Final outputs
  prediction: PredictionLabel;
  risk_level: RiskLevel;
  triage_level: string;
  // Optional ground truth
  true_binary?: number;
  correct?: boolean;
}

export interface PredictionSummary {
  total_events: number;
  normal_count: number;
  attack_count: number;
  high_risk: number;
  moderate_risk: number;
  low_risk: number;
  attack_rate: number;
  detection_rate: number;
}

export interface InferenceResponse {
  model: ModelName;
  summary: PredictionSummary;
  rows: PredictionRow[];
  processing_time_ms: number;
  errors: string[];
}

// ============================================================
// Model Metrics Types
// ============================================================

export interface ModelMetrics {
  model_name: string;
  split: "Test" | "Val";
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

export interface HybridConfig {
  w_lr: number;
  w_rf: number;
  decision_threshold: number;
  low_triage_threshold: number;
  high_triage_threshold: number;
  calibration_method: string;
}

export interface ModelConfig {
  model: ModelName;
  label: string;
  dataset: string;
  n_features: number;
  feature_list: string[];
  n_train: number;
  n_val: number;
  n_test: number;
  lr_params: Record<string, unknown>;
  rf_params: Record<string, unknown>;
  hybrid: HybridConfig;
  metrics: ModelMetrics[];
  runtime_seconds: number;
}

// ============================================================
// Feature Analysis Types
// ============================================================

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
  rank: number;
}

export interface FeatureStats {
  feature: string;
  normal_mean: number;
  normal_median: number;
  normal_std: number;
  attack_mean: number;
  attack_median: number;
  attack_std: number;
}

// ============================================================
// UI / Chart Types
// ============================================================

export interface AttackCategoryItem {
  name: string;
  count: number;
  percentage: number;
}

export interface RiskDistributionItem {
  name: RiskLevel;
  value: number;
  color: string;
}

export interface TimeSeriesPoint {
  hour: string;
  normal: number;
  attack: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

export interface FileUploadState {
  status: "idle" | "loading" | "success" | "error";
  fileName?: string;
  rowCount?: number;
  error?: string;
}

export interface ComparisonResult {
  primary: ModelMetrics;
  secondary: ModelMetrics;
  winner: Record<string, ModelName | "tie">;
}
