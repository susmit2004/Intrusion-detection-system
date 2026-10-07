"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";

interface TimelinePoint { hour: string; normal: number; attack: number }
export default function TimelineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="normalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.normal} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART_COLORS.normal} stopOpacity={0}    />
          </linearGradient>
          <linearGradient id="attackGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={CHART_COLORS.attack} stopOpacity={0.3}  />
            <stop offset="95%" stopColor={CHART_COLORS.attack} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
        <XAxis dataKey="hour" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
        <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 10 }} />
        <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" }} formatter={fmtNumber} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        <Area type="monotone" dataKey="normal" stroke={CHART_COLORS.normal} fill="url(#normalGrad)" strokeWidth={2} name="Normal" dot={false} />
        <Area type="monotone" dataKey="attack" stroke={CHART_COLORS.attack} fill="url(#attackGrad)" strokeWidth={2} name="Attack" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
