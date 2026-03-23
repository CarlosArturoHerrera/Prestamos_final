"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

type PieDatum = { name: string; value: number }

const COLORS = ["#22c55e", "#eab308", "#ef4444", "#64748b"]

export function EstadoPieChart({ data }: { data: PieDatum[] }) {
  if (data.length === 0) return <p className="pt-8 text-center text-sm text-muted-foreground">Sin datos</p>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
          {data.map((_, i) => (
            <Cell key={String(i)} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}
