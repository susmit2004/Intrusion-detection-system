"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";

const generateHistogram = () =>
  Array.from({ length: 10 }, (_, i) => ({
    label: `${(i/10).toFixed(1)}–${((i+1)/10).toFixed(1)}`,
    normal: i < 2 ? Math.floor(8000 + Math.random()*2000) : i < 4 ? Math.floor(2000 + Math.random()*500) : Math.floor(100 + Math.random()*100),
    attack: i >= 8 ? Math.floor(4000 + Math.random()*1500) : i >= 6 ? Math.floor(800 + Math.random()*400) : Math.floor(80 + Math.random()*60),
  }));

export default function ProbabilityHistogram({ threshold = 0.4536 }: { threshold?: number }) {
  const data = generateHistogram();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }} barCategoryGap="15%">
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="label" tick={{ fill: CHART_COLORS.text, fontSize: 9 }} />
        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} formatter={fmtNumber} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        <Bar dataKey="normal" fill={CHART_COLORS.normal} fillOpacity={0.8} name="Normal" stackId="a" />
        <Bar dataKey="attack" fill={CHART_COLORS.attack} fillOpacity={0.8} name="Attack" stackId="b" />
        <ReferenceLine
          x={`${Math.floor(threshold*10)/10}–${Math.ceil(threshold*10)/10}`}
          stroke="var(--accent)" strokeDasharray="4 2"
          label={{ value: `thr=${threshold.toFixed(4)}`, fill: "var(--accent)", fontSize: 10, position: "top" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
