"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, ScrollText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchApi } from "@/lib/fetch-api";
import { getRoleLabel } from "@/lib/roles";

/**
 * Registro de acciones administrativas (§28). Sólo lectura.
 *
 * `audit_logs` es append-only en la base de datos, así que no hay acciones de
 * edición ni de borrado: esta pantalla únicamente consulta.
 */

type Registro = {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  actor_email: string | null;
  actor_nombre: string | null;
  accion: string;
  entidad: string | null;
  entidad_id: string | null;
  admin_id: string | null;
  admin_nombre: string | null;
  detalle: Record<string, unknown>;
  ip: string | null;
  created_at: string;
};

type Cuenta = { id: string; nombre: string };

type Respuesta = {
  registros: Registro[];
  page: number;
  pageSize: number;
  total: number;
  acciones: string[];
  cuentas: Cuenta[];
};

/** Texto legible por acción. Si aparece una nueva, se muestra su código. */
const ETIQUETA_ACCION: Record<string, string> = {
  "admin.crear": "Creó un administrador",
  "admin.editar": "Editó un administrador",
  "admin.deshabilitar": "Deshabilitó un administrador",
  "admin.reactivar": "Reactivó un administrador",
  "admin.eliminar": "Eliminó un administrador",
  "admin.reset_password": "Inició cambio de contraseña",
  "admin.mantenimiento_configurar": "Configuró mantenimiento",
  "admin.mantenimiento_pago": "Registró un pago de mantenimiento",
  "admin.mensaje_enviar": "Envió un mensaje",
  "admin.mensaje_editar": "Editó un mensaje",
  "admin.mensaje_eliminar": "Eliminó un mensaje",
  "subusuario.crear": "Creó un subusuario",
  "subusuario.editar": "Editó un subusuario",
  "subusuario.deshabilitar": "Deshabilitó un subusuario",
  "subusuario.reactivar": "Reactivó un subusuario",
  "subusuario.eliminar": "Eliminó un subusuario",
  "subusuario.permisos": "Cambió permisos de un subusuario",
  "subusuario.reset_password": "Inició cambio de contraseña de un subusuario",
};

/** Tono de la fila según lo destructiva que sea la acción. */
function tono(accion: string): "default" | "secondary" | "destructive" {
  if (accion.includes("eliminar") || accion.includes("deshabilitar")) {
    return "destructive";
  }
  if (accion.includes("crear")) return "default";
  return "secondary";
}

function fecha(iso: string): string {
  try {
    return format(new Date(iso), "dd MMM yyyy · HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

/** Resumen de una línea del campo `detalle`, sin volcar el JSON crudo. */
function resumenDetalle(d: Record<string, unknown>): string {
  const partes: string[] = [];
  for (const [k, v] of Object.entries(d ?? {})) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      partes.push(`${k}: ${v.length}`);
    } else if (typeof v === "object") {
    } else {
      partes.push(`${k}: ${String(v)}`);
    }
  }
  return partes.join(" · ");
}

const TODAS = "__todas__";

export function AuditoriaTable() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [page, setPage] = useState(1);
  const [accion, setAccion] = useState<string>(TODAS);
  const [cuenta, setCuenta] = useState<string>(TODAS);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    const p = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (accion !== TODAS) p.set("accion", accion);
    if (cuenta !== TODAS) p.set("adminId", cuenta);
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);

    const res = await fetchApi<Respuesta>(`/api/admin/auditoria?${p}`);
    if (res.ok) setDatos(res.data);
    setCargando(false);
  }, [page, accion, cuenta, desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const total = datos?.total ?? 0;
  const pageSize = datos?.pageSize ?? 50;
  const ultimaPagina = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="aud-cuenta">Sobre la cuenta</Label>
          <Select
            value={cuenta}
            onValueChange={(v) => {
              setCuenta(v);
              setPage(1);
            }}
          >
            <SelectTrigger id="aud-cuenta" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {(datos?.cuentas ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aud-accion">Acción</Label>
          <Select
            value={accion}
            onValueChange={(v) => {
              setAccion(v);
              setPage(1);
            }}
          >
            <SelectTrigger id="aud-accion" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas</SelectItem>
              {(datos?.acciones ?? []).map((a) => (
                <SelectItem key={a} value={a}>
                  {ETIQUETA_ACCION[a] ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aud-desde">Desde</Label>
          <Input
            id="aud-desde"
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aud-hasta">Hasta</Label>
          <Input
            id="aud-hasta"
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setAccion(TODAS);
              setCuenta(TODAS);
              setDesde("");
              setHasta("");
              setPage(1);
            }}
          >
            Limpiar filtros
          </Button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[160px]">Fecha</TableHead>
              <TableHead>Quién</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead className="hidden lg:table-cell">
                Sobre la cuenta
              </TableHead>
              <TableHead className="hidden xl:table-cell">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}

            {!cargando && (datos?.registros.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <ScrollText className="mx-auto mb-2 size-7 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">
                    Sin registros
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    No hay acciones que coincidan con los filtros.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {!cargando &&
              datos?.registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                    {fecha(r.created_at)}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">
                      {r.actor_nombre ?? r.actor_email ?? "—"}
                    </p>
                    {r.actor_role && (
                      <p className="text-xs text-muted-foreground">
                        {getRoleLabel(r.actor_role)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tono(r.accion)} className="font-normal">
                      {ETIQUETA_ACCION[r.accion] ?? r.accion}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {r.admin_nombre ?? "—"}
                  </TableCell>
                  <TableCell className="hidden max-w-[280px] truncate text-sm text-muted-foreground xl:table-cell">
                    {resumenDetalle(r.detalle) || "—"}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Paginación ── */}
      {total > pageSize && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {total} registro{total === 1 ? "" : "s"} · página {page} de{" "}
            {ultimaPagina}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || cargando}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= ultimaPagina || cargando}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
