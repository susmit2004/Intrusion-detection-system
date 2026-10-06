"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CHART_COLORS } from "@/lib/utils";
import { fmtNumber } from "@/lib/chartHelpers";

export default function AttackDistributionChart({ normal, attack }: { normal: number; attack: number }) {
  const data = [{ name: "Normal", value: normal }, { name: "Attack", value: attack }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={3} dataKey="value" strokeWidth={0}>
          <Cell fill={CHART_COLORS.normal} />
          <Cell fill={CHART_COLORS.attack} />
        </Pie>
        <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }} formatter={fmtNumber} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
