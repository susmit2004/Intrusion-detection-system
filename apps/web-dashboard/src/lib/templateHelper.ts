/**
 * templateHelper.ts
 * Generates the 3-row ensemble CSV template data as a JS object array.
 * Mirrors the Python generate_template() output so the frontend
 * can offer a template download without a backend call.
 */

import { ENSEMBLE_COLUMNS } from "./ensembleData";

// All 34 ensemble columns with example values for three rows:
//   Row 0 – Normal web-browsing traffic
//   Row 1 – DoS-style attack
//   Row 2 – Brute-force FTP attack
const EXAMPLES: Record<string, number>[] = [
  // ── Row 0: Normal ──────────────────────────────────────────────
  {
    // Primary-specific
    proto_ICMP: 0, proto_TCP: 1, proto_UDP: 0,
    iface_ens192: 1, iface_eth0: 0,
    src_port_clean: 54321, dest_port_clean: 443,
    has_ports: 1, is_well_known_port: 1, is_ephemeral_src_port: 1,
    flow_pkts_toserver: 3, flow_pkts_toclient: 4,
    flow_bytes_toserver: 250, flow_bytes_toclient: 4800,
    avg_bytes_toserver_per_pkt: 83.3,
    pkt_asymmetry_ratio: 0.75, is_weekend: 0,
    // Shared – Primary scale
    pri_total_packets: 7, pri_total_bytes: 5050,
    pri_bytes_per_packet: 721.4,
    pri_hour_of_day: 14, pri_day_of_week: 1,
    // Secondary-specific
    "Source Port": 54321, "Destination Port": 443,
    "Total Fwd Packets": 3, "Total Backward Packets": 4,
    "Total Length of Fwd Packets": 120, "Total Length of Bwd Packets": 4800,
    packet_asymmetry_ratio: 0.75,
    // Shared – Secondary scale
    sec_total_packets: 7, sec_total_bytes: 4920,
    sec_bytes_per_packet: 702.9,
    sec_hour_of_day: 14, sec_day_of_week: 1,
  },
  // ── Row 1: DoS attack ──────────────────────────────────────────
  {
    proto_ICMP: 0, proto_TCP: 1, proto_UDP: 0,
    iface_ens192: 1, iface_eth0: 0,
    src_port_clean: 52180, dest_port_clean: 80,
    has_ports: 1, is_well_known_port: 1, is_ephemeral_src_port: 1,
    flow_pkts_toserver: 2, flow_pkts_toclient: 1,
    flow_bytes_toserver: 12, flow_bytes_toclient: 0,
    avg_bytes_toserver_per_pkt: 6.0,
    pkt_asymmetry_ratio: 2.0, is_weekend: 0,
    pri_total_packets: 3, pri_total_bytes: 12,
    pri_bytes_per_packet: 4.0,
    pri_hour_of_day: 10, pri_day_of_week: 4,
    "Source Port": 52180, "Destination Port": 80,
    "Total Fwd Packets": 2, "Total Backward Packets": 1,
    "Total Length of Fwd Packets": 12, "Total Length of Bwd Packets": 0,
    packet_asymmetry_ratio: 2.0,
    sec_total_packets: 3, sec_total_bytes: 12,
    sec_bytes_per_packet: 4.0,
    sec_hour_of_day: 10, sec_day_of_week: 4,
  },
  // ── Row 2: FTP brute-force ─────────────────────────────────────
  {
    proto_ICMP: 0, proto_TCP: 1, proto_UDP: 0,
    iface_ens192: 1, iface_eth0: 0,
    src_port_clean: 61000, dest_port_clean: 21,
    has_ports: 1, is_well_known_port: 1, is_ephemeral_src_port: 1,
    flow_pkts_toserver: 6, flow_pkts_toclient: 5,
    flow_bytes_toserver: 150, flow_bytes_toclient: 80,
    avg_bytes_toserver_per_pkt: 25.0,
    pkt_asymmetry_ratio: 1.2, is_weekend: 0,
    pri_total_packets: 11, pri_total_bytes: 230,
    pri_bytes_per_packet: 20.9,
    pri_hour_of_day: 9, pri_day_of_week: 3,
    "Source Port": 61000, "Destination Port": 21,
    "Total Fwd Packets": 6, "Total Backward Packets": 5,
    "Total Length of Fwd Packets": 150, "Total Length of Bwd Packets": 80,
    packet_asymmetry_ratio: 1.2,
    sec_total_packets: 11, sec_total_bytes: 230,
    sec_bytes_per_packet: 20.9,
    sec_hour_of_day: 9, sec_day_of_week: 3,
  },
];

/** Returns a list of plain objects (one per row) with all 34 ensemble columns. */
export function generate_template_data(): Record<string, number>[] {
  return EXAMPLES.map((row) => {
    const out: Record<string, number> = {};
    for (const col of ENSEMBLE_COLUMNS) {
      out[col] = col in row ? (row[col] as number) : 0;
    }
    return out;
  });
}
