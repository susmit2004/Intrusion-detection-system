// ============================================================
// Project Constants — derived from actual experiment configs
// ============================================================

// Secondary model (CIC-IDS-2017) — 12 features
export const SECONDARY_FEATURE_COLS = [
  "Source Port",
  "Destination Port",
  "Total Fwd Packets",
  "Total Backward Packets",
  "Total Length of Fwd Packets",
  "Total Length of Bwd Packets",
  "total_packets",
  "total_bytes",
  "bytes_per_packet",
  "packet_asymmetry_ratio",
  "hour_of_day",
  "day_of_week",
] as const;

// Primary model (Suricata testbed) — 22 features
export const PRIMARY_FEATURE_COLS = [
  "proto_ICMP",
  "proto_TCP",
  "proto_UDP",
  "iface_ens192",
  "iface_eth0",
  "src_port_clean",
  "dest_port_clean",
  "has_ports",
  "is_well_known_port",
  "is_ephemeral_src_port",
  "flow_pkts_toserver",
  "flow_pkts_toclient",
  "total_packets",
  "flow_bytes_toserver",
  "flow_bytes_toclient",
  "total_bytes",
  "bytes_per_packet",
  "avg_bytes_toserver_per_pkt",
  "pkt_asymmetry_ratio",
  "hour_of_day",
  "day_of_week",
  "is_weekend",
] as const;

// Columns that must NEVER be passed as model inputs (data-leakage guard)
export const FORBIDDEN_INPUT_COLS = new Set([
  "Label",
  "Attack Type",
  "Risk Level",
  "label_binary",
  "model_prediction",
  "model_prediction_label",
  "model_risk_level",
  "triage_level",
  "hybrid_score",
  "lr_prob_raw",
  "rf_prob_raw",
  "lr_prob_calibrated",
  "rf_prob_calibrated",
  "true_binary",
  "features_seen_in_development",
  "alert_signature",
  "alert_category",
  "alert_severity",
  "flow_id",
  "src_ip",
  "dest_ip",
]);

// Secondary model confirmed thresholds & weights
export const SECONDARY_CONFIG = {
  w_lr: 0.0,
  w_rf: 1.0,
  decision_threshold: 0.4536,
  low_triage_threshold: 0.0,
  high_triage_threshold: 1.0,
  calibration_method: "isotonic",
  risk_high_threshold: 0.70,
  risk_moderate_threshold: 0.40,
} as const;

// Primary model confirmed thresholds & weights
export const PRIMARY_CONFIG = {
  w_lr: 0.3,
  w_rf: 0.7,
  decision_threshold: 0.5025,
  low_triage_threshold: 0.2499,
  high_triage_threshold: 0.9863,
  calibration_method: "isotonic",
  risk_high_threshold: 0.70,
  risk_moderate_threshold: 0.40,
} as const;

// Risk colours (Tailwind-compatible)
export const RISK_COLORS = {
  "High Risk": {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-400",
    hex: "#f87171",
  },
  "Moderate Risk": {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-400",
    hex: "#fbbf24",
  },
  "Low Risk": {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    hex: "#34d399",
  },
} as const;

export const PREDICTION_COLORS = {
  Attack: { text: "text-red-400", bg: "bg-red-500/10", hex: "#f87171" },
  Normal: { text: "text-emerald-400", bg: "bg-emerald-500/10", hex: "#34d399" },
} as const;

export const MODEL_COLORS = {
  primary: { hex: "#60a5fa", text: "text-blue-400", bg: "bg-blue-500/10" },
  secondary: { hex: "#a78bfa", text: "text-violet-400", bg: "bg-violet-500/10" },
  lr: { hex: "#38bdf8", text: "text-sky-400" },
  rf: { hex: "#fb923c", text: "text-orange-400" },
  hybrid: { hex: "#a78bfa", text: "text-violet-400" },
} as const;

// Attack categories in CIC-IDS-2017
export const SECONDARY_ATTACK_TYPES = [
  "DoS Hulk",
  "PortScan",
  "DDoS",
  "DoS GoldenEye",
  "FTP-Patator",
  "SSH-Patator",
  "DoS Slowhttptest",
  "DoS slowloris",
  "Web Attack – Brute Force",
  "Bot",
  "Web Attack – XSS",
  "Infiltration",
] as const;

// Attack categories in Primary Suricata dataset
export const PRIMARY_ATTACK_TYPES = [
  "Attempted Denial of Service",
  "Attempted Administrator Privilege Gain",
  "A Network Trojan was detected",
  "Misc activity",
  "Potentially Bad Traffic",
  "Attempted Information Leak",
  "Web Application Attack",
  "Successful Administrator Privilege Gain",
] as const;

// Backend API base URL
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
