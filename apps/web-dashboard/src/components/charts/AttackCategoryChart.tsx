"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { AttackCategoryItem } from "@/types";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";

const COLORS = ["var(--accent)","var(--chart-orange)","var(--color-review)","var(--color-normal)","var(--model-lr)","var(--color-attack)","var(--color-normal-soft)","var(--accent-strong)","var(--risk-high-soft)","var(--risk-moderate-soft)","var(--text-secondary)","var(--text-muted)"];

export default function AttackCategoryChart({ data, horizontal = true }: { data: AttackCategoryItem[]; horizontal?: boolean }) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
  const TS = { contentStyle: { background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }, formatter: fmtNumber };

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
