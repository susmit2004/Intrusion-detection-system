"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { AttackCategoryItem } from "@/types";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";

const COLORS = ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#22d3ee","#60a5fa","#a78bfa","#f472b6","#e879f9","#94a3b8","#64748b"];

export default function AttackCategoryChart({ data, horizontal = true }: { data: AttackCategoryItem[]; horizontal?: boolean }) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
  const TS = { contentStyle: { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }, formatter: fmtNumber };

  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
          <YAxis dataKey="name" type="category" width={140} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
          <Tooltip {...TS} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} strokeWidth={0}>
            {sorted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sorted} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
        <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 9 }} angle={-40} textAnchor="end" />
        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
        <Tooltip {...TS} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} strokeWidth={0}>
          {sorted.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
