import { z } from "zod"
import { RESULTADOS_GESTION_COBRANZA } from "@/lib/gestion-cobranza"

const moneyString = z.union([
  z.string().regex(/^\d+(\.\d{1,4})?$/, "Monto inválido"),
  z.number().transform((n) => String(n)),
])
const positiveMoney = moneyString.refine((v) => Number(v) > 0, "Debe ser un monto mayor que 0")

export const empresaCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(500),
  rnc: z.string().max(100).optional().nullable(),
  direccion: z.string().max(1000).optional().nullable(),
  telefono: z.string().max(50).optional().nullable(),
  email: z.union([z.string().email("Email inválido"), z.literal(""), z.null()]).optional(),
})

export const representanteCreateSchema = z.object({
  nombre: z.string().min(1, "Nombre obligatorio").max(200),
  apellido: z.string().min(1, "Apellido obligatorio").max(200),
  telefono: z.string().min(1, "Teléfono / WhatsApp obligatorio").max(50),
  email: z.string().email("Email inválido"),
})

export const clienteCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  apellido: z.string().min(1).max(200),
  cedula: z.string().min(1).max(50),
  ubicacion: z.string().min(1).max(1000),
  telefono: z.string().min(1).max(50),
  estadoValidacion: z.enum(["VALIDADO", "PENDIENTE_VALIDAR"]).optional(),
  representanteId: z.coerce.number().int().positive({
    message: "Selecciona un representante",
  }),
  empresaId: z.coerce.number().int().positive({
    message: "Selecciona una empresa",
  }),
})

export const tipoPlazoSchema = z.enum(["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"])

export const prestamoCreateSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  monto: positiveMoney,
  tasaInteres: positiveMoney,
  capitalADebitar: positiveMoney,
  plazo: z.coerce.number().int().positive(),
  tipoPlazo: tipoPlazoSchema,
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  fechaProximoPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas: z.string().max(5000).optional().nullable(),
})

export const regancheSchema = z.object({
  montoAgregado: moneyString,
  notas: z.string().max(5000).optional().nullable(),
})

const abonoCreateSchemaInner = z.object({
  fechaAbono: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  montoCapitalDebitado: moneyString.optional(),
  /** Monto de interés que el cliente pagó en este abono (no es un pago mixto). */
  interesRecibido: moneyString.optional(),
  observaciones: z.string().max(2000).optional().nullable(),
}).refine((d) => d.montoCapitalDebitado !== undefined || d.interesRecibido !== undefined, {
  message: "Indica al menos Interés recibido o Capital a debitar",
})

function emptyToUndefined(v: unknown): unknown {
  return typeof v === "string" && v.trim() === "" ? undefined : v
}

/** Acepta `pago` (legado) como alias de `interesRecibido`; ignora strings vacíos. */
export const abonoCreateSchema = z.preprocess((data) => {
  if (!data || typeof data !== "object" || data === null) return data
  const o = { ...(data as Record<string, unknown>) }
  if ("pago" in o && !("interesRecibido" in o)) {
    o.interesRecibido = o.pago
  }
  delete o.pago
  o.interesRecibido = emptyToUndefined(o.interesRecibido)
  o.montoCapitalDebitado = emptyToUndefined(o.montoCapitalDebitado)
  return o
}, abonoCreateSchemaInner)

export const notificacionEnviarSchema = z
  .object({
    representanteIds: z.array(z.coerce.number().int().positive()).optional(),
    enviarATodos: z.boolean().optional(),
    canal: z.enum(["WHATSAPP", "EMAIL", "AMBOS"]),
    vistaPrevia: z.boolean().optional(),
  })
  .refine((d) => d.enviarATodos === true || (d.representanteIds && d.representanteIds.length > 0), {
    message: "Indique representanteIds o enviarATodos: true",
  })

export const reportesQuerySchema = z.object({
  empresaId: z.coerce.number().int().positive().optional(),
  representanteId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  estado: z.enum(["ACTIVO", "SALDADO", "MORA"]).optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
})

const fechaOpt = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? undefined : v))

export const gestionCobranzaCreateSchema = z.object({
  notas: z.string().max(5000).optional().nullable(),
  promesaMonto: z
    .union([moneyString, z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? undefined : v)),
  promesaFecha: fechaOpt,
  proximaFechaContacto: fechaOpt,
  resultado: z.enum(RESULTADOS_GESTION_COBRANZA),
  /** Solo en contexto cliente: asociar el seguimiento a un préstamo concreto. */
  prestamoId: z.coerce.number().int().positive().optional(),
})
