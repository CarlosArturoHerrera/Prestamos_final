"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api"
import { formatRD } from "@/lib/format-currency"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts"

export default function ReportesPage() {
  const [kpis, setKpis] = useState<Record<string, string> | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [empresas, setEmpresas] = useState<{ id: number; nombre: string }[]>([])
  const [reps, setReps] = useState<{ id: number; nombre: string; apellido: string }[]>([])
  const [filtros, setFiltros] = useState({
    empresaId: "",
    representanteId: "",
    clienteId: "",
    estado: "",
    fechaDesde: "",
    fechaHasta: "",
  })

  const load = useCallback(async () => {
    const q = new URLSearchParams()
    if (filtros.empresaId) q.set("empresaId", filtros.empresaId)
    if (filtros.representanteId) q.set("representanteId", filtros.representanteId)
    if (filtros.clienteId) q.set("clienteId", filtros.clienteId)
    if (filtros.estado) q.set("estado", filtros.estado)
    if (filtros.fechaDesde) q.set("fechaDesde", filtros.fechaDesde)
    if (filtros.fechaHasta) q.set("fechaHasta", filtros.fechaHasta)

    const res = await fetchApi<{ kpis: Record<string, string>; data: Record<string, unknown>[] }>(
      `/api/reportes?${q}`,
    )
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status)
      toast.error(res.message)
      return
    }
    setKpis(res.data.kpis)
    setRows(res.data.data ?? [])
  }, [filtros])

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    void (async () => {
      const [e, r] = await Promise.all([
        fetchApi<{ data: { id: number; nombre: string }[] }>("/api/empresas?pageSize=500"),
        fetchApi<{ data: { id: number; nombre: string; apellido: string }[] }>(
          "/api/representantes?pageSize=500",
        ),
      ])
      if (e.ok) setEmpresas(e.data.data ?? [])
      if (r.ok) setReps(r.data.data ?? [])
    })()
  }, [])

  const exportar = (formato: "pdf" | "excel") => {
    const q = new URLSearchParams({ formato })
    if (filtros.empresaId) q.set("empresaId", filtros.empresaId)
    if (filtros.representanteId) q.set("representanteId", filtros.representanteId)
    if (filtros.clienteId) q.set("clienteId", filtros.clienteId)
    if (filtros.estado) q.set("estado", filtros.estado)
    if (filtros.fechaDesde) q.set("fechaDesde", filtros.fechaDesde)
    if (filtros.fechaHasta) q.set("fechaHasta", filtros.fechaHasta)
    window.open(`/api/reportes/exportar?${q}`, "_blank")
  }

  const estadosCount = rows.reduce<Record<string, number>>((acc, r) => {
    const e = String(r.estado)
    acc[e] = (acc[e] ?? 0) + 1
    return acc
  }, {})

  const pieData = Object.entries(estadosCount).map(([name, value]) => ({ name, value }))

  const COLORS = ["#22c55e", "#eab308", "#ef4444", "#64748b"]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-muted-foreground">Cartera filtrable y exportación PDF / Excel.</p>
      </div>

      {kpis && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Total prestado</p>
            <p className="text-xl font-bold">{formatRD(kpis.total_prestado)}</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Total pendiente</p>
            <p className="text-xl font-bold">{formatRD(kpis.total_pendiente)}</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">En mora</p>
            <p className="text-xl font-bold">{formatRD(kpis.total_en_mora)}</p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-xs text-muted-foreground">Clientes activos</p>
            <p className="text-xl font-bold">{kpis.clientes_activos}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 rounded-xl border border-border/60 p-4 lg:col-span-2">
          <p className="font-medium">Filtros</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={filtros.empresaId || "all"}
                onValueChange={(v) => setFiltros({ ...filtros, empresaId: v === "all" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Representante</Label>
              <Select
                value={filtros.representanteId || "all"}
                onValueChange={(v) => setFiltros({ ...filtros, representanteId: v === "all" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.nombre} {r.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ID cliente</Label>
              <Input
                value={filtros.clienteId}
                onChange={(e) => setFiltros({ ...filtros, clienteId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado préstamo</Label>
              <Select
                value={filtros.estado || "all"}
                onValueChange={(v) => setFiltros({ ...filtros, estado: v === "all" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                  <SelectItem value="MORA">MORA</SelectItem>
                  <SelectItem value="SALDADO">SALDADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha inicio desde</Label>
              <Input
                type="date"
                value={filtros.fechaDesde}
                onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha inicio hasta</Label>
              <Input
                type="date"
                value={filtros.fechaHasta}
                onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={load}>Aplicar</Button>
            <Button variant="outline" onClick={() => exportar("pdf")}>
              PDF
            </Button>
            <Button variant="outline" onClick={() => exportar("excel")}>
              Excel
            </Button>
          </div>
        </div>

        <div className="min-h-[280px] w-full min-w-0 rounded-xl border border-border/60 p-2">
          <p className="mb-2 text-center text-sm font-medium">Estados (resultado filtrado)</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                {pieData.map((_, i) => (
                  <Cell key={String(i)} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Capital pend.</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Sin datos</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const c = r.clientes as
                  | {
                      nombre?: string
                      apellido?: string
                      empresas?: { nombre?: string }
                    }
                  | undefined
                return (
                  <TableRow key={String(r.id)}>
                    <TableCell>{String(r.id)}</TableCell>
                    <TableCell>
                      {c ? `${c.nombre ?? ""} ${c.apellido ?? ""}` : "—"}
                    </TableCell>
                    <TableCell>{c?.empresas?.nombre ?? "—"}</TableCell>
                    <TableCell>{formatRD(r.capital_pendiente as string)}</TableCell>
                    <TableCell>{String(r.estado)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
