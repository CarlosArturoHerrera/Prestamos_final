"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatRD } from "@/lib/format-currency"

export default function ClienteDetallePage() {
  const params = useParams()
  const id = Number(params.id)
  const [data, setData] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/clientes/${id}`)
    const j = await r.json()
    if (!r.ok) {
      toast.error(j.error ?? "Error")
      return
    }
    setData(j)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!data) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>
  }

  const prestamos = (data.prestamos as Record<string, unknown>[]) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/clientes">← Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {String(data.nombre)} {String(data.apellido)}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Cédula:</span> {String(data.cedula)}
          </p>
          <p>
            <span className="text-muted-foreground">Teléfono:</span> {String(data.telefono)}
          </p>
          <p>
            <span className="text-muted-foreground">Ubicación:</span> {String(data.ubicacion)}
          </p>
          <p>
            <span className="text-muted-foreground">Último pago:</span>{" "}
            {data.ultimo_pago ? String(data.ultimo_pago) : "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Préstamos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Capital pendiente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prestamos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>Sin préstamos</TableCell>
                </TableRow>
              ) : (
                prestamos.map((p) => (
                  <TableRow key={String(p.id)}>
                    <TableCell>#{String(p.id)}</TableCell>
                    <TableCell>{formatRD(p.capital_pendiente as string)}</TableCell>
                    <TableCell>{String(p.estado)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/prestamos/${p.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
