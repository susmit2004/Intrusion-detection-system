// ============================================================
// Ensemble-specific constants and mock data
// All 34 column names, descriptions, and mock results
// ============================================================

// The 5 shared feature names that have incompatible scales
export const SHARED_FEATURE_NAMES = [
  "bytes_per_packet",
  "total_bytes",
  "total_packets",
  "hour_of_day",
  "day_of_week",
] as const;

// All 34 ensemble CSV columns (alphabetical — matches Python ENSEMBLE_COLUMNS)
export const ENSEMBLE_COLUMNS = [
  "Destination Port",
  "Source Port",
  "Total Backward Packets",
  "Total Fwd Packets",
  "Total Length of Bwd Packets",
  "Total Length of Fwd Packets",
  "avg_bytes_toserver_per_pkt",
  "dest_port_clean",
  "flow_bytes_toclient",
  "flow_bytes_toserver",
  "flow_pkts_toclient",
  "flow_pkts_toserver",
  "has_ports",
  "iface_ens192",
  "iface_eth0",
  "is_ephemeral_src_port",
  "is_weekend",
  "is_well_known_port",
  "packet_asymmetry_ratio",
  "pkt_asymmetry_ratio",
  "pri_bytes_per_packet",
  "pri_day_of_week",
  "pri_hour_of_day",
  "pri_total_bytes",
  "pri_total_packets",
  "proto_ICMP",
  "proto_TCP",
  "proto_UDP",
  "sec_bytes_per_packet",
  "sec_day_of_week",
  "sec_hour_of_day",
  "sec_total_bytes",
  "sec_total_packets",
  "src_port_clean",
] as const;

export type EnsembleColumn = (typeof ENSEMBLE_COLUMNS)[number];

// Which model each column belongs to
export const COLUMN_MODEL: Record<EnsembleColumn, "primary" | "secondary" | "both"> = {
  "Destination Port":             "secondary",
  "Source Port":                  "secondary",
  "Total Backward Packets":       "secondary",
  "Total Fwd Packets":            "secondary",
  "Total Length of Bwd Packets":  "secondary",
  "Total Length of Fwd Packets":  "secondary",
  "avg_bytes_toserver_per_pkt":   "primary",
  "dest_port_clean":              "primary",
  "flow_bytes_toclient":          "primary",
  "flow_bytes_toserver":          "primary",
  "flow_pkts_toclient":           "primary",
  "flow_pkts_toserver":           "primary",
  "has_ports":                    "primary",
  "iface_ens192":                 "primary",
  "iface_eth0":                   "primary",
  "is_ephemeral_src_port":        "primary",
  "is_weekend":                   "primary",
  "is_well_known_port":           "primary",
  "packet_asymmetry_ratio":       "secondary",
  "pkt_asymmetry_ratio":          "primary",
  "pri_bytes_per_packet":         "primary",
  "pri_day_of_week":              "primary",
  "pri_hour_of_day":              "primary",
  "pri_total_bytes":              "primary",
  "pri_total_packets":            "primary",
  "proto_ICMP":                   "primary",
  "proto_TCP":                    "primary",
  "proto_UDP":                    "primary",
  "sec_bytes_per_packet":         "secondary",
  "sec_day_of_week":              "secondary",
  "sec_hour_of_day":              "secondary",
  "sec_total_bytes":              "secondary",
  "sec_total_packets":            "secondary",
  "src_port_clean":               "primary",
};

// Short description for each column
export const COLUMN_DOCS: Record<EnsembleColumn, string> = {
  "Destination Port":             "Target TCP/UDP port (Secondary / CIC-IDS-2017)",
  "Source Port":                  "Source TCP/UDP port (Secondary / CIC-IDS-2017)",
  "Total Backward Packets":       "Server→Client packets (Secondary)",
  "Total Fwd Packets":            "Client→Server packets (Secondary)",
  "Total Length of Bwd Packets":  "Backward bytes (Secondary)",
  "Total Length of Fwd Packets":  "Forward bytes (Secondary)",
  "avg_bytes_toserver_per_pkt":   "Bytes/pkt server direction (Primary)",
  "dest_port_clean":              "Destination port; -1 for ICMP (Primary)",
  "flow_bytes_toclient":          "Bytes server→client (Primary / Suricata)",
  "flow_bytes_toserver":          "Bytes client→server (Primary / Suricata)",
  "flow_pkts_toclient":           "Packets server→client (Primary)",
  "flow_pkts_toserver":           "Packets client→server (Primary)",
  "has_ports":                    "1 if TCP/UDP, 0 for ICMP (Primary)",
  "iface_ens192":                 "1 if interface=ens192 (Primary)",
  "iface_eth0":                   "1 if interface=eth0 (Primary)",
  "is_ephemeral_src_port":        "1 if src port > 49152 (Primary)",
  "is_weekend":                   "1 if Sat/Sun (Primary)",
  "is_well_known_port":           "1 if dest port 0–1023 (Primary)",
  "packet_asymmetry_ratio":       "Directional imbalance (Secondary)",
  "pkt_asymmetry_ratio":          "Directional imbalance (Primary)",
  "pri_bytes_per_packet":         "Bytes/pkt — PRIMARY scale (mean ~46 935)",
  "pri_day_of_week":              "Day 0–6 — PRIMARY distribution",
  "pri_hour_of_day":              "Hour 0–23 — PRIMARY distribution",
  "pri_total_bytes":              "Total bytes — PRIMARY scale (can reach 100k+)",
  "pri_total_packets":            "Total pkts — PRIMARY scale (usually 1–10)",
  "proto_ICMP":                   "1 if ICMP (Primary one-hot)",
  "proto_TCP":                    "1 if TCP (Primary one-hot)",
  "proto_UDP":                    "1 if UDP (Primary one-hot)",
  "sec_bytes_per_packet":         "Bytes/pkt — SECONDARY scale (attack median 6)",
  "sec_day_of_week":              "Day 0–4 — SECONDARY distribution",
  "sec_hour_of_day":              "Hour 0–12 — SECONDARY distribution",
  "sec_total_bytes":              "Total bytes — SECONDARY scale (attack median ~30)",
  "sec_total_packets":            "Total pkts — SECONDARY scale (median 4–5)",
  "src_port_clean":               "Source port; -1 for ICMP (Primary)",
};

// ── Default ensemble config ──────────────────────────────────────────────────
export const DEFAULT_ENSEMBLE_CONFIG = {
  w_primary:              0.5,
  w_secondary:            0.5,
  threshold:              0.5,
  risk_high_threshold:    0.70,
  risk_moderate_threshold: 0.40,
} as const;

// ── Mock ensemble result (matches EnsembleResult structure) ─────────────────
export interface EnsembleRowResult {
  row_index:         number;
  primary_score:     number;
  secondary_score:   number;
  ensemble_score:    number;
  primary_pred:      "Attack" | "Normal";
  secondary_pred:    "Attack" | "Normal";
  final_prediction:  "Attack" | "Normal";
  risk_level:        "High Risk" | "Moderate Risk" | "Low Risk";
  disagreement:      boolean;
}

export interface EnsembleSummary {
  total_rows:      number;
  skipped_rows:    number;
  normal_count:    number;
  attack_count:    number;
  high_risk:       number;
  moderate_risk:   number;
  low_risk:        number;
  disagreements:   number;
  attack_rate_pct: number;
  w_primary:       number;
  w_secondary:     number;
  threshold:       number;
  pri_threshold:   number;
  sec_threshold:   number;
}

export interface EnsembleApiResponse {
  summary:       EnsembleSummary;
  rows:          EnsembleRowResult[];
  errors:        string[];
  processing_ms: number;
}

// Mock result for demo/dev mode
export const MOCK_ENSEMBLE_RESULT: EnsembleApiResponse = {
  summary: {
    total_rows: 20, skipped_rows: 0,
    normal_count: 8, attack_count: 12,
    high_risk: 7, moderate_risk: 5, low_risk: 8,
    disagreements: 4,
    attack_rate_pct: 60.0,
    w_primary: 0.5, w_secondary: 0.5, threshold: 0.5,
    pri_threshold: 0.5025, sec_threshold: 0.4536,
  },
  rows: [
    { row_index:0,  primary_score:0.99, secondary_score:0.98, ensemble_score:0.985, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:1,  primary_score:0.02, secondary_score:0.01, ensemble_score:0.015, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:2,  primary_score:0.95, secondary_score:0.92, ensemble_score:0.935, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:3,  primary_score:0.03, secondary_score:0.02, ensemble_score:0.025, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:4,  primary_score:0.88, secondary_score:0.03, ensemble_score:0.455, primary_pred:"Attack", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Moderate Risk", disagreement:true  },
    { row_index:5,  primary_score:0.91, secondary_score:0.95, ensemble_score:0.930, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:6,  primary_score:0.06, secondary_score:0.04, ensemble_score:0.050, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:7,  primary_score:0.97, secondary_score:0.99, ensemble_score:0.980, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:8,  primary_score:0.58, secondary_score:0.62, ensemble_score:0.600, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"Moderate Risk", disagreement:false },
    { row_index:9,  primary_score:0.02, secondary_score:0.03, ensemble_score:0.025, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:10, primary_score:0.87, secondary_score:0.03, ensemble_score:0.450, primary_pred:"Attack", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Moderate Risk", disagreement:true  },
    { row_index:11, primary_score:0.94, secondary_score:0.96, ensemble_score:0.950, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:12, primary_score:0.01, secondary_score:0.01, ensemble_score:0.010, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:13, primary_score:0.73, secondary_score:0.78, ensemble_score:0.755, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:14, primary_score:0.48, secondary_score:0.55, ensemble_score:0.515, primary_pred:"Normal", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"Moderate Risk", disagreement:true  },
    { row_index:15, primary_score:0.04, secondary_score:0.02, ensemble_score:0.030, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:16, primary_score:0.85, secondary_score:0.89, ensemble_score:0.870, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
    { row_index:17, primary_score:0.03, secondary_score:0.04, ensemble_score:0.035, primary_pred:"Normal", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Low Risk",      disagreement:false },
    { row_index:18, primary_score:0.91, secondary_score:0.03, ensemble_score:0.470, primary_pred:"Attack", secondary_pred:"Normal", final_prediction:"Normal", risk_level:"Moderate Risk", disagreement:true  },
    { row_index:19, primary_score:0.76, secondary_score:0.80, ensemble_score:0.780, primary_pred:"Attack", secondary_pred:"Attack", final_prediction:"Attack", risk_level:"High Risk",     disagreement:false },
  ],
  errors: [],
  processing_ms: 234,
};
