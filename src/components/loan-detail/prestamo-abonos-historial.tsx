"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRD } from "@/lib/format-currency";
import {
  type CardField,
  ResponsiveHistoryCardList,
} from "./responsive-history-card-list";

type Props = {
  abonos: Record<string, unknown>[];
};

function num(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return formatRD(n);
}

// All fields shown in the mobile card view — same data as the desktop table.
const FIELDS: CardField[] = [
  {
    label: "Fecha",
    value: (r) => String(r.fecha_abono ?? "—"),
  },
  {
    label: "Total pagado",
    value: (r) => num(r.total_pagado),
    valueClassName: "font-semibold tabular-nums",
  },
  {
    label: "Capital debitado",
    value: (r) => num(r.monto_capital_debitado),
    valueClassName: "font-medium tabular-nums",
  },
  {
    label: "Interés recibido",
    value: (r) => num(r.interes_recibido),
    valueClassName: "tabular-nums",
  },
  {
    label: "Interés calculado",
    value: (r) => num(r.interes_calculado),
    valueClassName: "tabular-nums",
  },
  {
    label: "Dif. pendiente",
    value: (r) => num(r.diferencia_interes_pendiente),
    valueClassName: "tabular-nums",
    hidden: (r) => {
      const d = Number(r.diferencia_interes_pendiente);
      return Number.isNaN(d) || d === 0;
    },
  },
  {
    label: "Saldo capital",
    value: (r) => num(r.saldo_capital_restante),
    valueClassName: "font-medium tabular-nums",
  },
  {
    label: "Observaciones",
    value: (r) => String(r.observaciones ?? "").trim() || "—",
    hidden: (r) => !String(r.observaciones ?? "").trim(),
  },
];

export function PrestamoAbonosHistorial({ abonos }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de abonos</CardTitle>
        <CardDescription>
          Pagos realizados por el cliente para reducir el capital del préstamo.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {abonos.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            Sin abonos registrados.
          </p>
        ) : (
          <>
            {/* ── Móvil (<768 px) — tarjetas ── */}
            <ResponsiveHistoryCardList
              records={abonos}
              fields={FIELDS}
              rowKey={(r, i) => (r.id != null ? String(r.id) : `abono-${i}`)}
            />

            {/* ── Tablet / escritorio (≥768 px) — tabla ── */}
            <div className="hidden md:block">
              {/*
               * md (768-1023 px): 4 columnas visibles (Fecha, Total, Capital debitado, Saldo capital).
               * lg+ (≥1024 px): todas las columnas.
               */}
              <Table className="min-w-[320px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">
                      Capital debitado
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                      Int. recibido
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                      Int. calculado
                    </TableHead>
                    <TableHead className="hidden lg:table-cell text-right">
                      Dif. pendiente
                    </TableHead>
                    <TableHead className="text-right">Saldo capital</TableHead>
                    <TableHead className="hidden lg:table-cell">Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abonos.map((a, idx) => (
                    <TableRow
                      key={a.id != null ? String(a.id) : `abono-${idx}`}
                    >
                      <TableCell className="whitespace-nowrap">
                        {String(a.fecha_abono ?? "—")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(a.total_pagado)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(a.monto_capital_debitado)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {num(a.interes_recibido)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {num(a.interes_calculado)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right tabular-nums">
                        {num(a.diferencia_interes_pendiente)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(a.saldo_capital_restante)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell max-w-[200px] truncate text-muted-foreground">
                        {String(a.observaciones ?? "") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
