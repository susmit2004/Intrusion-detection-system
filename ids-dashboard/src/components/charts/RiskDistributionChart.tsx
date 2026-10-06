"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";

export default function RiskDistributionChart({ high, moderate, low }: { high: number; moderate: number; low: number }) {
  const data = [
    { name: "High Risk",     value: high,     color: CHART_COLORS.high     },
    { name: "Moderate Risk", value: moderate, color: CHART_COLORS.moderate },
    { name: "Low Risk",      value: low,      color: CHART_COLORS.low      },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }} formatter={fmtNumber} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} strokeWidth={0}>
          {data.map((e, i) => <Cell key={i} fill={e.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
