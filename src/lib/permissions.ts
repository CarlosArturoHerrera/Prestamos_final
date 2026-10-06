/**
 * permissions.ts — Catálogo de permisos granulares para subusuarios.
 *
 * Espejo exacto de la tabla `public.permissions` sembrada en la migración
 * 20261005000001_jerarquia_roles_tenancy.sql. Se duplica aquí sólo para tener
 * tipos en TypeScript y poder pintar el formulario de permisos sin un viaje a
 * la base de datos; la FUENTE DE VERDAD de la autorización es siempre la base
 * de datos (`public.has_permission()` + policies RLS) y la capa de API.
 *
 * Reglas de evaluación (idénticas en SQL y en TS):
 *   super_admin → todos los permisos
 *   admin       → todos los permisos dentro de SU organización
 *   sub_user    → únicamente los concedidos en `user_permissions`
 */

export const PERMISSION_CODES = [
  "dashboard.ver",

  "empresas.ver",
  "empresas.crear",
  "empresas.editar",
  "empresas.eliminar",

  "representantes.ver",
  "representantes.crear",
  "representantes.editar",
  "representantes.eliminar",
  "representantes.ganancias",

  "clientes.ver",
  "clientes.crear",
  "clientes.editar",
  "clientes.eliminar",

  "prestamos.ver",
  "prestamos.crear",
  "prestamos.editar",
  "prestamos.eliminar",
  "prestamos.saldar",

  "abonos.ver",
  "abonos.crear",
  "abonos.editar",

  "cobranza.ver",
  "cobranza.crear",
  "cobranza.editar",

  "notificaciones.ver",
  "notificaciones.enviar",

  "reportes.ver",
  "reportes.exportar",

  "subusuarios.ver",
  "configuracion.ver",
] as const;

/**
 * Permisos de PLATAFORMA — exclusivos del megaadministrador (§10).
 *
 * Van en una lista aparte a propósito: el megaadministrador administra
 * cuentas, no cartera. Deliberadamente NO existe ningun permiso del tipo
 * `clientes.ver_todos` ni equivalente, y `has_permission()` en la base de
 * datos devuelve FALSE a un megaadministrador para cualquier permiso de
 * negocio, por mucho que se le intente conceder.
 */
export const PLATFORM_PERMISSION_CODES = [
  "administradores.ver",
  "administradores.crear",
  "administradores.editar",
  "administradores.deshabilitar",
  "administradores.reactivar",
  "administradores.mantenimiento",
  "administradores.mensajes",
  "administradores.restablecer_password",
  "administradores.auditoria",
] as const;

export type PlatformPermissionCode = (typeof PLATFORM_PERMISSION_CODES)[number];

/** TRUE cuando el codigo pertenece al ambito de plataforma. */
export function isPlatformPermission(code: string): boolean {
  return code.startsWith("administradores.");
}

export type BusinessPermissionCode = (typeof PERMISSION_CODES)[number];

/** Cualquier permiso: de negocio o de plataforma. */
export type PermissionCode =
  | BusinessPermissionCode
  | (typeof PLATFORM_PERMISSION_CODES)[number];

export type PermissionModule =
  | "dashboard"
  | "empresas"
  | "representantes"
  | "clientes"
  | "prestamos"
  | "abonos"
  | "cobranza"
  | "notificaciones"
  | "reportes"
  | "configuracion";

export type PermissionDef = {
  code: PermissionCode;
  module: PermissionModule;
  label: string;
  description: string;
};

export const PERMISSIONS: readonly PermissionDef[] = [
  {
    code: "dashboard.ver",
    module: "dashboard",
    label: "Ver dashboard",
    description: "Acceder al panel principal y sus métricas",
  },

  {
    code: "empresas.ver",
    module: "empresas",
    label: "Ver empresas",
    description: "Listar y consultar empresas",
  },
  {
    code: "empresas.crear",
    module: "empresas",
    label: "Crear empresas",
    description: "Registrar nuevas empresas",
  },
  {
    code: "empresas.editar",
    module: "empresas",
    label: "Editar empresas",
    description: "Modificar datos de empresas",
  },
  {
    code: "empresas.eliminar",
    module: "empresas",
    label: "Eliminar empresas",
    description: "Borrar empresas",
  },

  {
    code: "representantes.ver",
    module: "representantes",
    label: "Ver representantes",
    description: "Listar y consultar representantes",
  },
  {
    code: "representantes.crear",
    module: "representantes",
    label: "Crear representantes",
    description: "Registrar nuevos representantes",
  },
  {
    code: "representantes.editar",
    module: "representantes",
    label: "Editar representantes",
    description: "Modificar datos de representantes",
  },
  {
    code: "representantes.eliminar",
    module: "representantes",
    label: "Eliminar representantes",
    description: "Borrar representantes",
  },
  {
    code: "representantes.ganancias",
    module: "representantes",
    label: "Ver ganancias",
    description: "Consultar el desglose de ganancias",
  },

  {
    code: "clientes.ver",
    module: "clientes",
    label: "Ver clientes",
    description: "Listar y consultar clientes",
  },
  {
    code: "clientes.crear",
    module: "clientes",
    label: "Crear clientes",
    description: "Registrar nuevos clientes",
  },
  {
    code: "clientes.editar",
    module: "clientes",
    label: "Editar clientes",
    description: "Modificar datos de clientes",
  },
  {
    code: "clientes.eliminar",
    module: "clientes",
    label: "Eliminar clientes",
    description: "Borrar clientes",
  },

  {
    code: "prestamos.ver",
    module: "prestamos",
    label: "Ver préstamos",
    description: "Listar y consultar préstamos",
  },
  {
    code: "prestamos.crear",
    module: "prestamos",
    label: "Crear préstamos",
    description: "Registrar nuevos préstamos",
  },
  {
    code: "prestamos.editar",
    module: "prestamos",
    label: "Editar préstamos",
    description: "Modificar préstamos y aplicar reganches",
  },
  {
    code: "prestamos.eliminar",
    module: "prestamos",
    label: "Eliminar préstamos",
    description: "Borrar préstamos",
  },
  {
    code: "prestamos.saldar",
    module: "prestamos",
    label: "Saldar préstamos",
    description: "Marcar un préstamo como saldado",
  },

  {
    code: "abonos.ver",
    module: "abonos",
    label: "Ver abonos",
    description: "Consultar el historial de pagos",
  },
  {
    code: "abonos.crear",
    module: "abonos",
    label: "Registrar abonos",
    description: "Registrar pagos de capital e interés",
  },
  {
    code: "abonos.editar",
    module: "abonos",
    label: "Editar abonos",
    description: "Modificar o anular abonos",
  },

  {
    code: "cobranza.ver",
    module: "cobranza",
    label: "Ver gestión de cobranza",
    description: "Consultar el seguimiento de cobranza",
  },
  {
    code: "cobranza.crear",
    module: "cobranza",
    label: "Registrar gestión",
    description: "Añadir notas y promesas de pago",
  },
  {
    code: "cobranza.editar",
    module: "cobranza",
    label: "Editar gestión",
    description: "Modificar registros de cobranza",
  },

  {
    code: "notificaciones.ver",
    module: "notificaciones",
    label: "Ver notificaciones",
    description: "Consultar el historial de envíos",
  },
  {
    code: "notificaciones.enviar",
    module: "notificaciones",
    label: "Enviar notificaciones",
    description: "Enviar mensajes por WhatsApp / email",
  },

  {
    code: "reportes.ver",
    module: "reportes",
    label: "Ver reportes",
    description: "Consultar reportes de cartera",
  },
  {
    code: "reportes.exportar",
    module: "reportes",
    label: "Exportar reportes",
    description: "Descargar reportes en Excel / PDF",
  },

  {
    code: "subusuarios.ver",
    module: "configuracion",
    label: "Ver subusuarios",
    description: "Listar los subusuarios de la organización",
  },
  {
    code: "configuracion.ver",
    module: "configuracion",
    label: "Ver configuración",
    description: "Acceder a la configuración de la cuenta",
  },
] as const;

export const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  empresas: "Empresas",
  representantes: "Representantes",
  clientes: "Clientes",
  prestamos: "Préstamos",
  abonos: "Abonos",
  cobranza: "Cobranza",
  notificaciones: "Notificaciones",
  reportes: "Reportes",
  configuracion: "Configuración",
};

/** Orden de módulos tal como se muestran en el formulario de permisos. */
export const MODULE_ORDER: readonly PermissionModule[] = [
  "dashboard",
  "clientes",
  "prestamos",
  "abonos",
  "cobranza",
  "representantes",
  "empresas",
  "notificaciones",
  "reportes",
  "configuracion",
];

export function permissionsByModule(): Record<
  PermissionModule,
  PermissionDef[]
> {
  const out = {} as Record<PermissionModule, PermissionDef[]>;
  for (const m of MODULE_ORDER) out[m] = [];
  for (const p of PERMISSIONS) out[p.module].push(p);
  return out;
}

/** Conjunto por defecto que se propone al crear un subusuario: sólo lectura. */
export const DEFAULT_SUBUSER_PERMISSIONS: readonly PermissionCode[] = [
  "dashboard.ver",
  "clientes.ver",
  "prestamos.ver",
  "abonos.ver",
  "cobranza.ver",
];

export function isPermissionCode(value: unknown): value is PermissionCode {
  return (
    typeof value === "string" &&
    (PERMISSION_CODES as readonly string[]).includes(value)
  );
}
