"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Info,
  Megaphone,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/fetch-api";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Isla de avisos que aparece al iniciar sesión (§22, §23).
 *
 * Muestra dos cosas y sólo cuando hay algo que decir:
 *   • Estado de mantenimiento, si está PENDIENTE o VENCIDO.
 *   • Mensajes del megaadministrador sin leer y no caducados.
 *
 * Usa los tokens visuales del sistema (card, border, muted-foreground,
 * destructive) y la curva de animación compartida, para que parezca parte del
 * producto y no un añadido.
 *
 * El contenido de los mensajes es de SÓLO LECTURA para el administrador: aquí
 * únicamente se puede marcar como leído, y eso mismo lo refuerzan la policy
 * RLS y un trigger en la base de datos.
 */

type Mantenimiento = {
  estado: "AL_DIA" | "PENDIENTE" | "VENCIDO" | "EXENTO";
  dia_pago: number | null;
  monto: number | null;
  ultimo_pago: string | null;
  proximo_pago: string | null;
  notas: string | null;
};

type Mensaje = {
  id: number;
  titulo: string;
  cuerpo: string;
  tipo: "INFO" | "ADVERTENCIA" | "URGENTE";
  created_at: string;
  expira_en: string | null;
};

type Avisos = { mantenimiento: Mantenimiento | null; mensajes: Mensaje[] };

function fecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return "—";
  }
}

function moneda(v: number | null): string | null {
  if (v == null) return null;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(v);
}

const ESTILO_MENSAJE = {
  INFO: {
    icon: Info,
    wrap: "border-border bg-card",
    accent: "text-muted-foreground",
  },
  ADVERTENCIA: {
    icon: AlertTriangle,
    wrap: "border-amber-500/30 bg-amber-500/[0.06]",
    accent: "text-amber-600 dark:text-amber-400",
  },
  URGENTE: {
    icon: Megaphone,
    wrap: "border-destructive/30 bg-destructive/[0.06]",
    accent: "text-destructive",
  },
} as const;

export function AvisosIsla() {
  const [avisos, setAvisos] = useState<Avisos | null>(null);
  const [ocultoMantenimiento, setOcultoMantenimiento] = useState(false);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [marcando, setMarcando] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const res = await fetchApi<Avisos>("/api/mi-cuenta/avisos");
      if (!cancelado && res.ok) setAvisos(res.data);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const marcarLeido = async (id: number) => {
    setMarcando(id);
    const res = await fetchApi("/api/mi-cuenta/avisos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setAvisos((prev) =>
        prev
          ? { ...prev, mensajes: prev.mensajes.filter((m) => m.id !== id) }
          : prev,
      );
    }
    setMarcando(null);
  };

  if (!avisos) return null;

  const mant = avisos.mantenimiento;
  const mostrarMant = mant != null && !ocultoMantenimiento;
  if (!mostrarMant && avisos.mensajes.length === 0) return null;

  const vencido = mant?.estado === "VENCIDO";

  return (
    <div className="mb-6 space-y-3">
      <AnimatePresence initial={false}>
        {/* ── Mantenimiento ── */}
        {mostrarMant && mant && (
          <motion.div
            key="mantenimiento"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE.out }}
            className={cn(
              "relative rounded-xl border p-4",
              vencido
                ? "border-destructive/30 bg-destructive/[0.06]"
                : "border-amber-500/30 bg-amber-500/[0.06]",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  vencido
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                <CalendarClock className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {vencido
                    ? "Mantenimiento vencido"
                    : "Mantenimiento pendiente"}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {vencido
                    ? "Tu pago de mantenimiento está vencido. Regularízalo para evitar interrupciones."
                    : "Tienes un pago de mantenimiento próximo."}
                </p>

                <AnimatePresence initial={false}>
                  {detalleAbierto && (
                    <motion.dl
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: EASE.out }}
                      className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 overflow-hidden text-sm sm:grid-cols-4"
                    >
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Vencimiento
                        </dt>
                        <dd className="font-medium text-foreground">
                          {fecha(mant.proximo_pago)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Último pago
                        </dt>
                        <dd className="font-medium text-foreground">
                          {fecha(mant.ultimo_pago)}
                        </dd>
                      </div>
                      {mant.monto != null && (
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Monto
                          </dt>
                          <dd className="font-medium text-foreground">
                            {moneda(mant.monto)}
                          </dd>
                        </div>
                      )}
                      {mant.dia_pago != null && (
                        <div>
                          <dt className="text-xs text-muted-foreground">
                            Día de pago
                          </dt>
                          <dd className="font-medium text-foreground">
                            {mant.dia_pago} de cada mes
                          </dd>
                        </div>
                      )}
                      {mant.notas && (
                        <div className="col-span-2 sm:col-span-4">
                          <dt className="text-xs text-muted-foreground">
                            Notas
                          </dt>
                          <dd className="text-foreground">{mant.notas}</dd>
                        </div>
                      )}
                    </motion.dl>
                  )}
                </AnimatePresence>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8"
                  onClick={() => setDetalleAbierto((v) => !v)}
                >
                  {detalleAbierto ? "Ocultar información" : "Ver información"}
                </Button>
              </div>

              <button
                type="button"
                aria-label="Descartar aviso de mantenimiento"
                onClick={() => setOcultoMantenimiento(true)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Mensajes del megaadministrador ── */}
        {avisos.mensajes.map((m) => {
          const estilo = ESTILO_MENSAJE[m.tipo];
          const Icono = estilo.icon;
          return (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: EASE.out }}
              className={cn("rounded-xl border p-4", estilo.wrap)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.04]",
                    estilo.accent,
                  )}
                >
                  <Icono className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {m.titulo}
                  </p>
                  {/* whitespace-pre-line conserva los saltos de línea que
                      escribió el megaadministrador sin interpretar HTML. */}
                  <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                    {m.cuerpo}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    {fecha(m.created_at)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 shrink-0"
                  disabled={marcando === m.id}
                  onClick={() => void marcarLeido(m.id)}
                >
                  <Check className="size-3.5" />
                  <span className="hidden sm:inline">Entendido</span>
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
