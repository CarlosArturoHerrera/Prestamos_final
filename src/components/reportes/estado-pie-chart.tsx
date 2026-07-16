"use client";

import { useMemo } from "react";
import type {
  PieLabelRenderProps,
  PieSectorShapeProps,
  TooltipPayloadEntry,
} from "recharts";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";

type PieDatum = { name: string; value: number };

type StatusStyle = { label: string; from: string; to: string };

/** Estado enum values are ACTIVO / MORA / SALDADO (see validations/schemas.ts).
 * PENDIENTE / CANCELADO are mapped in case those states are introduced later. */
const STATUS_STYLES: Record<string, StatusStyle> = {
  ACTIVO: { label: "Activos", from: "#0052CC", to: "#00D2FF" },
  SALDADO: { label: "Completados", from: "#2563EB", to: "#60A5FA" },
  PENDIENTE: { label: "Pendientes", from: "#00D2FF", to: "#60A5FA" },
  CANCELADO: { label: "Cancelados", from: "#64748B", to: "#94A3B8" },
  MORA: { label: "Vencidos", from: "#DC2626", to: "#F97316" },
};

const FALLBACK_STYLE: Omit<StatusStyle, "label"> = {
  from: "#64748B",
  to: "#94A3B8",
};

function styleFor(name: string): StatusStyle {
  const known = STATUS_STYLES[name.toUpperCase()];
  if (known) return known;
  return { label: name, ...FALLBACK_STYLE };
}

const RADIAN = Math.PI / 180;

function renderOuterLabel(props: PieLabelRenderProps) {
  const {
    cx,
    cy,
    midAngle = 0,
    outerRadius,
    percent = 0,
    value,
    payload,
  } = props;
  if (percent < 0.04) return null;

  const name = String(payload?.name ?? "");
  const { label } = styleFor(name);
  const centerX = Number(cx);
  const radius = Number(outerRadius) + 26;
  const x = centerX + radius * Math.cos(-midAngle * RADIAN);
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN);
  const anchor = x > centerX ? "start" : "end";

  return (
    <g>
      <text
        x={x}
        y={y - 12}
        textAnchor={anchor}
        className="fill-foreground text-[11px] font-semibold"
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 2}
        textAnchor={anchor}
        className="fill-foreground text-[11px] font-bold tabular-nums"
      >
        {Math.round(percent * 100)}%
      </text>
      <text
        x={x}
        y={y + 16}
        textAnchor={anchor}
        className="fill-muted-foreground text-[10px] tabular-nums"
      >
        ({value})
      </text>
    </g>
  );
}

function ActiveAwareSlice(props: PieSectorShapeProps) {
  const { fill, isActive, outerRadius, ...rest } = props;
  return (
    <Sector
      {...rest}
      outerRadius={isActive ? outerRadius + 6 : outerRadius}
      fill={fill}
      style={{
        filter: isActive
          ? "drop-shadow(0 6px 10px rgba(0, 82, 204, 0.35))"
          : "drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18))",
        transition:
          "outer-radius 250ms cubic-bezier(0.4, 0, 0.2, 1), filter 250ms ease",
      }}
    />
  );
}

function CustomTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const { label, from, to } = styleFor(String(item.name));
  const value = Number(item.value) || 0;
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div
      className="rounded-xl border px-3 py-2.5 shadow-lg"
      style={{
        background: "#0F172A",
        borderColor: "#2563EB",
        boxShadow: "0 12px 28px -10px rgba(0, 82, 204, 0.5)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        />
        <span className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>
          {label}
        </span>
      </div>
      <p className="mt-1 text-xs" style={{ color: "#94A3B8" }}>
        {value} préstamos · {percent}%
      </p>
    </div>
  );
}

export function EstadoPieChart({ data }: { data: PieDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const entries = useMemo(
    () =>
      data.map((d, i) => ({
        ...d,
        gradientId: `estado-gradient-${i}`,
        style: styleFor(d.name),
      })),
    [data],
  );

  if (data.length === 0)
    return (
      <p className="pt-8 text-center text-sm text-muted-foreground">
        Sin datos
      </p>
    );

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative w-full">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <defs>
              {entries.map((entry) => (
                <linearGradient
                  key={entry.gradientId}
                  id={entry.gradientId}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop offset="0%" stopColor={entry.style.from} />
                  <stop offset="100%" stopColor={entry.style.to} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={entries}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={96}
              paddingAngle={3}
              cornerRadius={6}
              stroke="#ffffff"
              strokeWidth={2}
              isAnimationActive
              animationBegin={80}
              animationDuration={900}
              animationEasing="ease-out"
              labelLine={false}
              label={renderOuterLabel}
              shape={ActiveAwareSlice}
            >
              {entries.map((entry) => (
                <Cell key={entry.name} fill={`url(#${entry.gradientId})`} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {total}
          </span>
          <span className="text-[11px] text-muted-foreground">préstamos</span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((entry) => {
          const percent =
            total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li
              key={entry.name}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${entry.style.from}, ${entry.style.to})`,
                  }}
                />
                <span className="truncate font-medium text-foreground">
                  {entry.style.label}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">
                  {entry.value}
                </span>
                <span className="tabular-nums">({percent}%)</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
