"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRD } from "@/lib/format-currency"
import {
  type CardField,
  ResponsiveHistoryCardList,
} from "./responsive-history-card-list"

type Props = {
  reganches: Record<string, unknown>[]
}

const FIELDS: CardField[] = [
  {
    label: "Fecha",
    value: (r) => String(r.created_at ?? "").slice(0, 10) || "—",
  },
  {
    label: "Monto agregado",
    value: (r) => {
      const m = Number(r.monto_agregado ?? 0)
      return Number.isNaN(m) ? "—" : formatRD(m)
    },
    valueClassName: "font-semibold tabular-nums",
  },
  {
    label: "Notas / origen",
    value: (r) => String(r.notas ?? "") || "—",
  },
]

export function PrestamoReganchesHistorial({ reganches }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de reganches</CardTitle>
        <CardDescription>
          Aumentos al capital: reganche manual (formulario) o capitalización de
          interés (AUTO / MANUAL).
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {reganches.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Sin reganches.</p>
        ) : (
          <>
            {/* ── Móvil (<768 px) — tarjetas ── */}
            <ResponsiveHistoryCardList
              records={reganches}
              fields={FIELDS}
              rowKey={(r, i) => (r.id != null ? String(r.id) : `reg-${i}`)}
            />

            {/* ── Tablet / escritorio (≥768 px) — tabla ── */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Monto agregado</TableHead>
                    <TableHead>Notas / origen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reganches.map((r, idx) => {
                    const m = Number(r.monto_agregado ?? 0)
                    return (
                      <TableRow
                        key={r.id != null ? String(r.id) : `reg-${idx}`}
                      >
                        <TableCell className="whitespace-nowrap">
                          {String(r.created_at ?? "").slice(0, 10) || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {Number.isNaN(m) ? "—" : formatRD(m)}
                        </TableCell>
                        <TableCell className="max-w-md text-muted-foreground">
                          {String(r.notas ?? "") || "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
