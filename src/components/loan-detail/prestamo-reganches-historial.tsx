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

type Props = {
  reganches: Record<string, unknown>[]
}

export function PrestamoReganchesHistorial({ reganches }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de reganches</CardTitle>
        <CardDescription>
          Aumentos al capital: reganche manual (formulario) o capitalización de interés (AUTO / MANUAL).
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 sm:p-6">
        {reganches.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Sin reganches.</p>
        ) : (
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
                  <TableRow key={r.id != null ? String(r.id) : `reg-${idx}`}>
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
        )}
      </CardContent>
    </Card>
  )
}
