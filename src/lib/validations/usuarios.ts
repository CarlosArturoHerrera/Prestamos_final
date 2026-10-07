import { z } from "zod";
import { unformatCedula, unformatPhone } from "@/lib/formatters";
import { PERMISSION_CODES } from "@/lib/permissions";

/**
 * Esquemas de validación de la jerarquía de usuarios.
 *
 * Nota deliberada: NINGÚN esquema acepta `role`, `adminId` ni `permissions`
 * como campos de identidad del propio solicitante. El rol y la organización los
 * fija SIEMPRE el servidor a partir de la sesión (§29). Lo que el cliente envía
 * son datos de la persona, nunca su nivel de acceso.
 */

const passwordField = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(200, "La contraseña es demasiado larga");

const usernameField = z
  .string()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(60, "El usuario es demasiado largo")
  .regex(
    /^[A-Za-z0-9._@+-]+$/,
    "El usuario sólo admite letras, números y . _ @ + -",
  );

const telefonoField = z
  .string()
  .min(1, "El teléfono es obligatorio")
  .max(50)
  .transform(unformatPhone);

const cedulaField = z
  .union([z.string().max(50), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? unformatCedula(v) : null));

export const permissionCodeSchema = z.enum(
  PERMISSION_CODES as unknown as [string, ...string[]],
);

/** §10 — formulario de creación de administradores (megaadministrador). */
export const administradorCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(200),
  apellido: z.string().min(1, "El apellido es obligatorio").max(200),
  cedula: cedulaField,
  telefono: telefonoField,
  email: z.string().email("Email inválido"),
  username: usernameField,
  password: passwordField,
  /** Máximo de subusuarios. null o ausente = sin límite. */
  limiteSubusuarios: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000)
    .nullable()
    .optional(),
});

export const administradorUpdateSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  apellido: z.string().min(1).max(200).optional(),
  cedula: cedulaField,
  telefono: z.string().max(50).transform(unformatPhone).optional(),
  email: z.string().email("Email inválido").optional(),
  username: usernameField.optional(),
  isActive: z.boolean().optional(),
  /** Máximo de subusuarios. null = sin límite. Sólo lo fija el megaadmin. */
  limiteSubusuarios: z.coerce
    .number()
    .int()
    .min(0)
    .max(1000)
    .nullable()
    .optional(),
});

/** §13 — creación de subusuarios por parte de un administrador. */
export const subusuarioCreateSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(200),
  apellido: z.string().min(1, "El apellido es obligatorio").max(200),
  cedula: cedulaField,
  telefono: z
    .union([z.string().max(50), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? unformatPhone(v) : null)),
  email: z.string().email("Email inválido"),
  username: usernameField,
  password: passwordField,
  permisos: z.array(permissionCodeSchema).max(100).optional(),
});

export const subusuarioUpdateSchema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  apellido: z.string().min(1).max(200).optional(),
  cedula: cedulaField,
  telefono: z
    .union([z.string().max(50), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? unformatPhone(v) : null)),
  email: z.string().email("Email inválido").optional(),
  username: usernameField.optional(),
  isActive: z.boolean().optional(),
  /** Reemplaza el conjunto completo de permisos cuando viene informado. */
  permisos: z.array(permissionCodeSchema).max(100).optional(),
  /** Dispara el envío del correo de restablecimiento de contraseña. */
  action: z.enum(["reset_password"]).optional(),
});

/** §21 — configuración de mantenimiento de un administrador. */
export const mantenimientoUpdateSchema = z.object({
  /**
   * "AUTO" no es un estado almacenable: significa "deja de estar exento y
   * calcula el estado a partir de las fechas y los pagos". La ruta lo traduce.
   */
  estado: z
    .enum(["AUTO", "AL_DIA", "PENDIENTE", "VENCIDO", "EXENTO", "PRUEBA"])
    .optional(),
  diaPago: z.coerce.number().int().min(1).max(31).nullable().optional(),
  monto: z.coerce.number().min(0).nullable().optional(),
  proximoPago: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  notas: z.string().max(2000).nullable().optional(),
});

export const mantenimientoPagoSchema = z.object({
  monto: z.coerce.number().min(0, "El monto no puede ser negativo"),
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)")
    .optional(),
  metodo: z.string().max(100).nullable().optional(),
  notas: z.string().max(2000).nullable().optional(),
});

/** §23 — mensajes personalizados del megaadministrador. */
export const mensajeCreateSchema = z.object({
  adminId: z.string().uuid("Administrador inválido"),
  titulo: z.string().min(1, "El título es obligatorio").max(200),
  cuerpo: z.string().min(1, "El mensaje no puede estar vacío").max(5000),
  tipo: z.enum(["INFO", "ADVERTENCIA", "URGENTE"]).optional(),
  expiraEn: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v ? v : null)),
});

export const mensajeUpdateSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  cuerpo: z.string().min(1).max(5000).optional(),
  tipo: z.enum(["INFO", "ADVERTENCIA", "URGENTE"]).optional(),
  expiraEn: z
    .union([
      z.string().datetime(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((v) => (v ? v : null)),
  /** Única mutación permitida al administrador destinatario. */
  marcarLeido: z.boolean().optional(),
});

/** Login por email O nombre de usuario. */
export const identificadorSchema = z.object({
  identificador: z
    .string()
    .min(1, "Introduce tu usuario o correo")
    .max(200)
    .transform((v) => v.trim()),
});
