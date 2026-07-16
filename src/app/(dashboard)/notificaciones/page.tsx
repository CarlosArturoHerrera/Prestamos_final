"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api";
import { formatPhone } from "@/lib/formatters";
import { usePageCachedState } from "@/lib/page-cache";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

type Rep = {
  id: number;
  nombre: string;
  apellido: string;
  telefono?: string | null;
};

type NotifRow = {
  id: number;
  canal: string;
  estado: string;
  fecha_envio: string;
  mensaje: string;
  error_detalle: string | null;
  twilio_from?: string | null;
  twilio_to?: string | null;
  twilio_message_sid?: string | null;
  email_to?: string | null;
  representantes: { nombre: string; apellido: string } | null;
};

function estadoBadge(estado: string) {
  const s = String(estado ?? "").toUpperCase();
  if (["DELIVERED", "READ", "ENVIADO"].includes(s))
    return {
      variant: "default" as const,
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 uppercase tracking-wide",
    };
  if (["QUEUED", "ACCEPTED", "SENDING", "SENT", "PROCESANDO"].includes(s))
    return {
      variant: "secondary" as const,
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-wide",
    };
  if (["FAILED", "UNDELIVERED", "ERROR"].includes(s))
    return {
      variant: "destructive" as const,
      className: "uppercase tracking-wide",
    };
  return {
    variant: "secondary" as const,
    className: "uppercase tracking-wide",
  };
}

/** Returns a short date+time in es-DO locale. */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-DO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function NotificacionesPage() {
  const [rows, setRows] = usePageCachedState<NotifRow[]>(
    "notificaciones:rows",
    [],
  );
  const [reps, setReps] = usePageCachedState<Rep[]>("notificaciones:reps", []);
  const [filtroRep, setFiltroRep] = useState("");
  const [filtroCedula, setFiltroCedula] = useState("");
  const filtroCedulaDebounced = useDebouncedValue(filtroCedula, 350);
  const [canal, setCanal] = useState("");
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [sendingPreview, setSendingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const [form, setForm] = useState({
    enviarATodos: false,
    representanteIds: [] as number[],
    canal: "AMBOS" as "WHATSAPP" | "EMAIL" | "AMBOS",
  });

  const load = useCallback(async () => {
    setLoadingHistorial(true);
    const q = new URLSearchParams();
    if (filtroRep) q.set("representanteId", filtroRep);
    if (filtroCedulaDebounced) q.set("cedula", filtroCedulaDebounced);
    if (canal) q.set("canal", canal);
    const res = await fetchApi<{ data: NotifRow[] }>(
      `/api/notificaciones?${q}`,
    );
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      toast.error(res.message);
      setRows([]);
    } else {
      setRows(res.data.data ?? []);
    }
    setLoadingHistorial(false);
  }, [filtroRep, filtroCedulaDebounced, canal]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/representantes?pageSize=200")
      .then((r) => r.json())
      .then((j) => setReps(j.data ?? []));
  }, []);

  const buildBody = (preview: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      canal: form.canal,
      vistaPrevia: preview,
      enviarATodos: form.enviarATodos,
    };
    if (!form.enviarATodos && form.representanteIds.length > 0) {
      body.representanteIds = form.representanteIds;
    }
    return body;
  };

  const vistaPrevia = async () => {
    if (sendingPreview) return;
    setSendingPreview(true);
    const res = await fetchApi<{ data: { mensaje?: string }[] }>(
      "/api/notificaciones/enviar",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(true)),
      },
    );
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      toast.error(res.message);
      setSendingPreview(false);
      return;
    }
    const first = res.data.data?.[0];
    setPreview(first?.mensaje ?? JSON.stringify(res.data, null, 2));
    toast.message("Vista previa generada");
    setSendingPreview(false);
  };

  const enviar = async () => {
    if (sending) return;
    setSending(true);
    const res = await fetchApi<{ data: { estado?: string; error?: string }[] }>(
      "/api/notificaciones/enviar",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(false)),
      },
    );
    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      toast.error(res.message);
      setSending(false);
      return;
    }
    const resultados = res.data?.data ?? [];
    const enviados = resultados.filter(
      (r) => String(r.estado ?? "").toUpperCase() === "ENVIADO",
    ).length;
    const errores = resultados.filter(
      (r) => String(r.estado ?? "").toUpperCase() === "ERROR" || r.error,
    ).length;
    const total = resultados.length;

    if (total === 0) {
      toast.message("Sin representantes para enviar");
    } else if (errores === 0) {
      toast.success(
        `Proceso terminado: ${enviados} enviado${enviados !== 1 ? "s" : ""}`,
      );
    } else if (enviados === 0) {
      toast.error(
        `Proceso terminado: ${errores} error${errores !== 1 ? "es" : ""} — ninguno enviado`,
      );
    } else {
      toast.warning(
        `Proceso terminado: ${enviados} enviado${enviados !== 1 ? "s" : ""}, ${errores} error${errores !== 1 ? "es" : ""}`,
      );
    }

    await load();
    setSending(false);
  };

  const toggleRep = (id: number) => {
    setForm((prev) => ({
      ...prev,
      representanteIds: prev.representanteIds.includes(id)
        ? prev.representanteIds.filter((x) => x !== id)
        : [...prev.representanteIds, id],
    }));
  };

  const removeRep = (id: number) => {
    setForm((prev) => ({
      ...prev,
      representanteIds: prev.representanteIds.filter((x) => x !== id),
    }));
  };

  const selectedReps = reps.filter((r) => form.representanteIds.includes(r.id));

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8">
        {/* ── Header ── */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Notificaciones
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Envío de reportes de mora por WhatsApp (Twilio) y correo. Configura
            las variables de entorno para activar cada canal.
          </p>
        </div>

        {/* ── Send form ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            {/* Switch "Enviar a todos" */}
            <div
              className={cn(
                "rounded-xl border p-4 transition-all duration-200",
                form.enviarATodos
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-border bg-card",
              )}
            >
              <div className="flex items-start gap-4">
                <Switch
                  id="enviar-todos"
                  checked={form.enviarATodos}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      enviarATodos: checked,
                      representanteIds: [],
                    })
                  }
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor="enviar-todos"
                    className="cursor-pointer text-sm font-semibold leading-none"
                  >
                    Enviar a todos los representantes
                  </Label>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed"></p>
                  {form.enviarATodos && reps.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="secondary" className="tabular-nums">
                        {reps.length} representante
                        {reps.length !== 1 ? "s" : ""}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        recibirán el mensaje
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Destinatarios individuales */}
            {!form.enviarATodos && (
              <div className="space-y-2">
                <Label>Destinatarios</Label>

                {/* Multi-select trigger */}
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={pickerOpen}
                      className="h-10 w-full justify-between font-normal"
                    >
                      <span
                        className={cn(
                          "truncate text-sm",
                          form.representanteIds.length === 0 &&
                            "text-muted-foreground",
                        )}
                      >
                        {form.representanteIds.length === 0
                          ? "Seleccionar representantes…"
                          : `${form.representanteIds.length} seleccionado${form.representanteIds.length !== 1 ? "s" : ""}`}
                      </span>
                      <ChevronsUpDown
                        className="ml-2 size-4 shrink-0 opacity-50"
                        aria-hidden
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(100vw-2rem,var(--radix-popover-trigger-width))] max-w-sm p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Buscar por nombre o teléfono…" />
                      <CommandList>
                        <CommandEmpty>Sin coincidencias</CommandEmpty>
                        <CommandGroup>
                          {reps.map((r) => {
                            const selected = form.representanteIds.includes(
                              r.id,
                            );
                            const phone = r.telefono
                              ? formatPhone(r.telefono)
                              : null;
                            return (
                              <CommandItem
                                key={r.id}
                                value={`${r.nombre} ${r.apellido} ${r.telefono ?? ""}`}
                                onSelect={() => toggleRep(r.id)}
                                className="gap-2"
                              >
                                <Check
                                  className={cn(
                                    "size-4 shrink-0",
                                    selected ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                <div className="min-w-0 flex-1">
                                  {phone ? (
                                    <>
                                      <div className="font-medium tabular-nums">
                                        {phone}
                                      </div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {r.nombre} {r.apellido}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="font-medium">
                                        {r.nombre} {r.apellido}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Sin teléfono
                                      </div>
                                    </>
                                  )}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* Selected chips */}
                {selectedReps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReps.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium"
                      >
                        {r.telefono
                          ? formatPhone(r.telefono)
                          : `${r.nombre} ${r.apellido}`}
                        <button
                          type="button"
                          onClick={() => removeRep(r.id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                          aria-label={`Eliminar ${r.nombre} ${r.apellido}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Canal */}
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select
                value={form.canal}
                onValueChange={(v) =>
                  setForm({ ...form, canal: v as typeof form.canal })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="AMBOS">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                onClick={vistaPrevia}
                disabled={sendingPreview}
                className="w-full sm:w-auto"
              >
                {sendingPreview ? "Generando…" : "Vista previa"}
              </Button>
              <Button
                onClick={enviar}
                disabled={sending}
                className="w-full sm:w-auto"
              >
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>

          {/* Preview textarea */}
          <div className="space-y-2">
            <Label>Vista previa del mensaje</Label>
            <Textarea
              value={preview}
              readOnly
              className="min-h-[260px] resize-none font-mono text-xs"
              placeholder='Pulsa "Vista previa" para generar el mensaje'
            />
          </div>
        </div>

        {/* ── History filters ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historial de envíos
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Select
              value={filtroRep || "all"}
              onValueChange={(v) => setFiltroRep(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Representante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los representantes</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.nombre} {r.apellido}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Filtrar por cédula"
              value={filtroCedula}
              onChange={(e) => setFiltroCedula(e.target.value)}
              className="w-full sm:max-w-[200px]"
            />
            <Select
              value={canal || "all"}
              onValueChange={(v) => setCanal(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="AMBOS">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={load}
              className="w-full sm:w-auto"
            >
              Aplicar filtros
            </Button>
          </div>
        </div>

        {/* ── Desktop table ── */}
        <div className="hidden md:block min-w-0">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[130px]" />
              <col className="w-[150px]" />
              <col className="w-[86px]" />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Fecha</TableHead>
                <TableHead>Representante</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Mensaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistorial && rows.length === 0 ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell>
                        <div className="h-3 w-24 rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-28 rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-14 rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-5 w-20 rounded-full bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-24 rounded bg-muted" />
                      </TableCell>
                      <TableCell>
                        <div className="h-3 w-full rounded bg-muted" />
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <MessageSquare className="size-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        Sin notificaciones enviadas
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((n) => {
                  const destino = n.twilio_to
                    ? formatPhone(n.twilio_to)
                    : (n.email_to ?? "—");
                  const repName = n.representantes
                    ? `${n.representantes.nombre} ${n.representantes.apellido}`
                    : "—";

                  return (
                    <TableRow key={n.id} className="group">
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(n.fecha_envio)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="truncate">{repName}</div>
                      </TableCell>
                      <TableCell className="text-sm">{n.canal}</TableCell>
                      <TableCell>
                        <Badge {...estadoBadge(n.estado)}>{n.estado}</Badge>
                        {n.error_detalle ? (
                          <p className="mt-1 text-[11px] text-destructive leading-snug whitespace-normal line-clamp-2">
                            {n.error_detalle}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate cursor-default font-mono text-sm tabular-nums">
                              {destino}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-xs space-y-1 text-xs"
                          >
                            <p>
                              <span className="font-semibold">
                                Representante:
                              </span>{" "}
                              {repName}
                            </p>
                            {n.twilio_from && (
                              <p>
                                <span className="font-semibold">Desde:</span>{" "}
                                {formatPhone(n.twilio_from)}
                              </p>
                            )}
                            {n.twilio_message_sid && (
                              <p>
                                <span className="font-semibold">SID:</span>{" "}
                                {n.twilio_message_sid}
                              </p>
                            )}
                            {n.email_to && (
                              <p>
                                <span className="font-semibold">Email:</span>{" "}
                                {n.email_to}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate cursor-default">
                              {n.mensaje}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="start"
                            className="max-w-sm whitespace-pre-wrap text-xs leading-relaxed"
                          >
                            {n.mensaje}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Mobile cards ── */}
        <div className="md:hidden space-y-3">
          {loadingHistorial && rows.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2">
                      <div className="h-4 w-36 rounded bg-muted" />
                      <div className="h-3 w-24 rounded bg-muted" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-muted" />
                  </div>
                  <div className="mt-3 h-3 w-full max-w-[280px] rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 py-12 text-center">
              <MessageSquare className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Sin notificaciones enviadas
              </p>
            </div>
          ) : (
            rows.map((n) => {
              const destino = n.twilio_to
                ? formatPhone(n.twilio_to)
                : (n.email_to ?? "—");
              return (
                <div
                  key={n.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {destino}
                        </span>
                        <Badge {...estadoBadge(n.estado)}>{n.estado}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {n.representantes
                          ? `${n.representantes.nombre} ${n.representantes.apellido}`
                          : "—"}
                        {" · "}
                        {n.canal}
                        {" · "}
                        {fmtDate(n.fecha_envio)}
                      </p>
                    </div>
                  </div>
                  {n.mensaje && (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {n.mensaje}
                    </p>
                  )}
                  {n.error_detalle && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {n.error_detalle}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
