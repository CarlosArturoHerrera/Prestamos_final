"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CalendarClock,
  CheckCircle2,
  KeyRound,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserCog,
  UsersRound,
  UserX,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { AdminUser } from "@/app/(dashboard)/admin/users/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CedulaInput } from "@/components/ui/cedula-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { Textarea } from "@/components/ui/textarea";
import {
  type AuthActor,
  type AuthTarget,
  canDeleteUser,
  canShowRowActions,
  canToggleUser,
} from "@/lib/authorization";
import { getRoleBadgeVariant, getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface UsersTableProps {
  users: AdminUser[];
  currentUserId: string;
  currentUserRole: "super_admin" | "admin";
}

type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; user: AdminUser }
  | { type: "delete"; user: AdminUser }
  | { type: "toggle"; user: AdminUser }
  | { type: "reset_password"; user: AdminUser }
  | { type: "mantenimiento"; user: AdminUser }
  | { type: "mensaje"; user: AdminUser };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Etiqueta y tono del estado de mantenimiento (§21). */
const MANTENIMIENTO_UI = {
  AL_DIA: { label: "Al día", variant: "secondary" as const },
  PRUEBA: { label: "Mes de prueba", variant: "outline" as const },
  PENDIENTE: { label: "Pendiente", variant: "outline" as const },
  VENCIDO: { label: "Vencido", variant: "destructive" as const },
  EXENTO: { label: "Exento", variant: "secondary" as const },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

/** Fecha sin hora, para columnas estrechas. */
function fmtDateShort(iso: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy", { locale: es });
  } catch {
    return "—";
  }
}

async function apiFetch(
  url: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Main component ────────────────────────────────────────────────────────────

export function UsersTable({
  users: initialUsers,
  currentUserId,
  currentUserRole,
}: UsersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  // Filtro por situación de mantenimiento. "atrasado" agrupa VENCIDO y
  // PENDIENTE: ambos son cobros que están esperando, que es lo que se quiere
  // localizar de un vistazo.
  const [filterMant, setFilterMant] = useState<
    "all" | "atrasado" | "vencido" | "al_dia" | "prueba" | "exento"
  >("all");

  // Formularios: la API de administradores pide los campos de §9/§10
  // (nombre y apellido por separado, cédula, teléfono y nombre de usuario).
  const FORM_VACIO = {
    nombre: "",
    apellido: "",
    cedula: "",
    telefono: "",
    email: "",
    username: "",
    password: "",
    limiteSubusuarios: "",
  };
  const [form, setForm] = useState(FORM_VACIO);

  // Mantenimiento (§21) y mensajes (§23). Se cargan al abrir cada diálogo.
  // `diaPagoFecha` es solo el selector: de el se extrae el dia del mes que
  // se repite cada periodo. `proximoPago` es la fecha concreta del siguiente
  // vencimiento, y avanza sola al registrar un pago.
  const MANT_VACIO = {
    diaPagoFecha: "",
    monto: "",
    estado: "",
    proximoPago: "",
  };
  const [mant, setMant] = useState(MANT_VACIO);

  // La fecha del pago arranca en hoy y se puede cambiar.
  const hoyISO = new Date().toISOString().slice(0, 10);
  const PAGO_VACIO = { monto: "", fechaPago: hoyISO };
  const [pago, setPago] = useState(PAGO_VACIO);

  const MENSAJE_VACIO = {
    titulo: "",
    cuerpo: "",
    tipo: "INFO",
    expiraEn: "",
  };
  const [mensaje, setMensaje] = useState(MENSAJE_VACIO);

  const [loading, setLoading] = useState(false);

  // Actor = the currently logged-in user (always super_admin on this page)
  const actor: AuthActor = { userId: currentUserId, role: currentUserRole };

  function closeDialog() {
    setDialog({ type: "none" });
    setForm(FORM_VACIO);
    setMant(MANT_VACIO);
    setPago(PAGO_VACIO);
    setMensaje(MENSAJE_VACIO);
  }

  /** Precarga el diálogo de mantenimiento con lo que ya esté configurado. */
  function openMantenimiento(user: AdminUser) {
    // El estado lo deduce el servidor de las fechas y los pagos, asi que el
    // selector arranca en "Automatico". La unica excepcion es EXENTO: es una
    // decision manual del megaadministrador y no debe perderla un recalculo.
    const estadoActual = user.mantenimiento?.estado;

    // En la base solo vive el DIA (1-31). Para poder elegirlo con un
    // calendario se sintetiza una fecha del mes en curso con ese dia.
    const dia = user.mantenimiento?.dia_pago;
    let diaPagoFecha = "";
    if (dia != null) {
      const hoy = new Date();
      const diasDelMes = new Date(
        hoy.getFullYear(),
        hoy.getMonth() + 1,
        0,
      ).getDate();
      const d = String(Math.min(dia, diasDelMes)).padStart(2, "0");
      const m = String(hoy.getMonth() + 1).padStart(2, "0");
      diaPagoFecha = `${hoy.getFullYear()}-${m}-${d}`;
    }

    setMant({
      diaPagoFecha,
      monto: user.mantenimiento?.monto?.toString() ?? "",
      // EXENTO y PRUEBA son decisiones manuales: se conservan al reabrir.
      // El resto arranca en "Automático" para que lo deduzcan las fechas.
      estado:
        estadoActual === "EXENTO" || estadoActual === "PRUEBA"
          ? estadoActual
          : "AUTO",
      proximoPago: user.mantenimiento?.proximo_pago ?? "",
    });
    setPago(PAGO_VACIO);
    setDialog({ type: "mantenimiento", user });
  }

  function openCreate() {
    setForm(FORM_VACIO);
    setDialog({ type: "create" });
  }

  function openEdit(user: AdminUser) {
    setForm({
      nombre: user.first_name ?? "",
      apellido: user.last_name ?? "",
      cedula: user.cedula ?? "",
      telefono: user.telefono ?? "",
      email: user.email ?? "",
      username: user.username ?? "",
      password: "",
      limiteSubusuarios: user.limite_subusuarios?.toString() ?? "",
    });
    setDialog({ type: "edit", user });
  }

  const refresh = () =>
    startTransition(() => {
      router.refresh();
    });

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = initialUsers.filter((u) => {
    const matchSearch =
      !search ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && u.is_active) ||
      (filterStatus === "inactive" && !u.is_active);

    const em = u.mantenimiento?.estado;
    const matchMant =
      filterMant === "all" ||
      (filterMant === "atrasado" && (em === "VENCIDO" || em === "PENDIENTE")) ||
      (filterMant === "vencido" && em === "VENCIDO") ||
      (filterMant === "al_dia" && em === "AL_DIA") ||
      (filterMant === "prueba" && em === "PRUEBA") ||
      (filterMant === "exento" && em === "EXENTO");

    return matchSearch && matchStatus && matchMant;
  });

  // Cuántos tienen el cobro esperando, para poder enseñarlo en el propio
  // selector sin que haya que filtrar para descubrirlo.
  const atrasados = initialUsers.filter(
    (u) =>
      u.mantenimiento?.estado === "VENCIDO" ||
      u.mantenimiento?.estado === "PENDIENTE",
  ).length;

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (
      !form.nombre ||
      !form.apellido ||
      !form.email ||
      !form.username ||
      !form.password ||
      !form.telefono
    ) {
      toast.error(
        "Nombre, apellido, teléfono, correo, usuario y contraseña son obligatorios",
      );
      return;
    }
    setLoading(true);
    try {
      // El rol NO se envía: lo fija el servidor como 'admin' (§29).
      const res = await apiFetch("/api/admin/users", "POST", {
        nombre: form.nombre,
        apellido: form.apellido,
        cedula: form.cedula || undefined,
        telefono: form.telefono,
        email: form.email,
        username: form.username,
        password: form.password,
        limiteSubusuarios:
          form.limiteSubusuarios === "" ? null : Number(form.limiteSubusuarios),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Administrador creado correctamente");
        closeDialog();
        refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(userId: string) {
    setLoading(true);
    try {
      const body: Record<string, string | number | null> = {};
      if (form.nombre) body.nombre = form.nombre;
      if (form.apellido) body.apellido = form.apellido;
      if (form.cedula) body.cedula = form.cedula;
      if (form.telefono) body.telefono = form.telefono;
      if (form.email) body.email = form.email;
      if (form.username) body.username = form.username;
      // Vacío significa "sin límite", que en la base es NULL. Hay que
      // enviarlo explícitamente: omitirlo dejaría el límite anterior intacto.
      body.limiteSubusuarios =
        form.limiteSubusuarios === "" ? null : Number(form.limiteSubusuarios);

      const res = await apiFetch(`/api/admin/users/${userId}`, "PATCH", body);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Usuario actualizado");
        closeDialog();
        refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  // ── Mantenimiento (§21) ───────────────────────────────────────────────────

  async function handleGuardarMantenimiento(userId: string) {
    setLoading(true);
    try {
      // Sólo se envía lo que el megaadministrador haya rellenado: así un
      // campo vacío no borra un valor ya configurado.
      const body: Record<string, unknown> = {};

      // Del selector de fecha solo interesa el dia del mes. Se extrae por
      // posicion (YYYY-MM-DD) en vez de con new Date(), que desplazaria la
      // fecha un dia segun la zona horaria del navegador.
      if (mant.diaPagoFecha !== "") {
        body.diaPago = Number(mant.diaPagoFecha.slice(8, 10));
      }
      if (mant.proximoPago !== "") body.proximoPago = mant.proximoPago;
      if (mant.monto !== "") body.monto = Number(mant.monto);
      // El estado viaja SIEMPRE. Pasar de "Exento" a "Automático" es un cambio
      // real aunque no se toque ningún otro campo, y antes se perdía: el cuerpo
      // quedaba vacío y la pantalla respondía "No hay nada que guardar".
      body.estado = mant.estado || "AUTO";

      const res = await apiFetch(
        `/api/admin/users/${userId}/mantenimiento`,
        "PATCH",
        body,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Mantenimiento actualizado");
        closeDialog();
        refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistrarPago(userId: string) {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/users/${userId}/mantenimiento`,
        "POST",
        {
          monto: Number(pago.monto),
          fechaPago: pago.fechaPago || undefined,
        },
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Pago registrado");
        closeDialog();
        refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  // ── Mensajes personalizados (§23) ─────────────────────────────────────────

  async function handleEnviarMensaje(userId: string) {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/mensajes", "POST", {
        adminId: userId,
        titulo: mensaje.titulo,
        cuerpo: mensaje.cuerpo,
        tipo: mensaje.tipo,
        expiraEn: mensaje.expiraEn || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Mensaje enviado");
        closeDialog();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(user: AdminUser) {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, "PATCH", {
        isActive: !user.is_active,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          user.is_active ? "Cuenta desactivada" : "Cuenta reactivada",
        );
        closeDialog();
        refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(userId: string) {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, "DELETE");
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Administrador eliminado");
        closeDialog();
        refresh();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(user: AdminUser) {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, "PATCH", {
        action: "reset_password",
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Email de recuperación enviado");
        closeDialog();
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {(["all", "active", "inactive"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s)}
                className="text-xs"
              >
                {s === "all"
                  ? "Todos"
                  : s === "active"
                    ? "Activos"
                    : "Inactivos"}
              </Button>
            ))}
          </div>

          {/* Situacion de mantenimiento. "Atrasados" lleva el contador al lado
              para que se vea cuantos hay sin necesidad de filtrar. */}
          <Select
            value={filterMant}
            onValueChange={(v) => setFilterMant(v as typeof filterMant)}
          >
            <SelectTrigger className="h-8 w-full text-xs sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mantenimiento: todos</SelectItem>
              <SelectItem value="atrasado">
                Atrasados{atrasados > 0 ? ` (${atrasados})` : ""}
              </SelectItem>
              <SelectItem value="vencido">Sólo vencidos</SelectItem>
              <SelectItem value="al_dia">Al día</SelectItem>
              <SelectItem value="prueba">Mes de prueba</SelectItem>
              <SelectItem value="exento">Exentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="size-4 mr-1.5" />
            Nuevo administrador
          </Button>
        </div>
      </div>

      {/* Stats badges */}
      <div className="flex gap-3 text-sm">
        <span className="text-muted-foreground">
          Total: <strong>{initialUsers.length}</strong>
        </span>
        <span className="text-muted-foreground">
          Activos:{" "}
          <strong className="text-green-600">
            {initialUsers.filter((u) => u.is_active).length}
          </strong>
        </span>
        <span className="text-muted-foreground">
          Inactivos:{" "}
          <strong className="text-red-500">
            {initialUsers.filter((u) => !u.is_active).length}
          </strong>
        </span>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/60 p-4 text-center text-sm text-muted-foreground shadow-sm">
            No se encontraron usuarios
          </div>
        ) : (
          filtered.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const isSuperAdminRow = user.role === "super_admin";
            const target: AuthTarget = { id: user.id, role: user.role };
            const showActions = canShowRowActions(actor, target);
            const showToggle = canToggleUser(actor, target);
            const showDelete = canDeleteUser(actor, target);
            return (
              <div
                key={user.id}
                className={cn(
                  "rounded-xl border border-border bg-card/80 p-4 shadow-sm",
                  !user.is_active && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {user.full_name ?? (
                          <span className="italic text-muted-foreground">
                            Sin nombre
                          </span>
                        )}
                      </span>
                      {isCurrentUser && (
                        <Badge
                          variant="outline"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          Tú
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {user.email ?? "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {isSuperAdminRow && (
                          <ShieldAlert className="mr-1 size-3" />
                        )}
                        {getRoleLabel(user.role)}
                      </Badge>
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="size-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                          <XCircle className="size-3.5" /> Inactivo
                        </span>
                      )}
                    </div>
                  </div>
                  {showActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(user)}>
                          <UserCog className="mr-2 size-4" />
                          {isCurrentUser ? "Editar mi perfil" : "Editar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            setDialog({ type: "reset_password", user })
                          }
                        >
                          <KeyRound className="mr-2 size-4" />
                          {isCurrentUser
                            ? "Restablecer mi contraseña"
                            : "Restablecer contraseña"}
                        </DropdownMenuItem>
                        {showToggle && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setDialog({ type: "toggle", user })
                              }
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="mr-2 size-4" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 size-4" />
                                  Reactivar
                                </>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                        {showDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                setDialog({ type: "delete", user })
                              }
                            >
                              <Trash2 className="mr-2 size-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="mt-3 space-y-0.5 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  <p>Creado: {fmtDate(user.created_at)}</p>
                  <p>Último acceso: {fmtDate(user.last_sign_in_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table className="min-w-[380px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden lg:table-cell">
                Mantenimiento
              </TableHead>
              <TableHead className="hidden xl:table-cell">
                Subusuarios
              </TableHead>
              <TableHead className="hidden xl:table-cell">Creado</TableHead>
              <TableHead className="hidden xl:table-cell">
                Último acceso
              </TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-muted-foreground"
                >
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const isSuperAdminRow = user.role === "super_admin";
                const target: AuthTarget = { id: user.id, role: user.role };

                // Decisions driven by centralized authorization module
                const showActions = canShowRowActions(actor, target);
                const showToggle = canToggleUser(actor, target);
                const showDelete = canDeleteUser(actor, target);

                return (
                  <TableRow
                    key={user.id}
                    className={!user.is_active ? "opacity-60" : undefined}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.full_name ?? (
                          <span className="text-muted-foreground italic">
                            Sin nombre
                          </span>
                        )}
                        {isCurrentUser && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            Tú
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm max-w-[200px]">
                      <span className="block truncate">
                        {user.email ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {isSuperAdminRow && (
                          <ShieldAlert className="size-3 mr-1" />
                        )}
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                          <CheckCircle2 className="size-4" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 text-sm font-medium">
                          <XCircle className="size-4" /> Inactivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.role === "super_admin" ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : user.mantenimiento ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant={
                              MANTENIMIENTO_UI[user.mantenimiento.estado]
                                .variant
                            }
                            className="w-fit"
                          >
                            {MANTENIMIENTO_UI[user.mantenimiento.estado].label}
                          </Badge>
                          {user.mantenimiento.proximo_pago && (
                            <span className="text-xs text-muted-foreground">
                              Vence{" "}
                              {fmtDateShort(user.mantenimiento.proximo_pago)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin configurar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm tabular-nums">
                      {user.role === "super_admin" ? (
                        "—"
                      ) : user.limite_subusuarios == null ? (
                        user.subusuarios
                      ) : (
                        <span
                          className={cn(
                            user.subusuarios >= user.limite_subusuarios &&
                              "font-medium text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {user.subusuarios} / {user.limite_subusuarios}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {fmtDate(user.created_at)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                      {fmtDate(user.last_sign_in_at)}
                    </TableCell>
                    <TableCell>
                      {showActions && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <UserCog className="size-4 mr-2" />
                              {isCurrentUser ? "Editar mi perfil" : "Editar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setDialog({ type: "reset_password", user })
                              }
                            >
                              <KeyRound className="size-4 mr-2" />
                              {isCurrentUser
                                ? "Restablecer mi contraseña"
                                : "Restablecer contraseña"}
                            </DropdownMenuItem>
                            {user.role === "admin" && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/admin/users/${user.id}/subusuarios`}
                                  >
                                    <UsersRound className="size-4 mr-2" />
                                    Subusuarios
                                    {user.subusuarios > 0 && (
                                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                                        {user.subusuarios}
                                      </span>
                                    )}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openMantenimiento(user)}
                                >
                                  <CalendarClock className="size-4 mr-2" />
                                  Mantenimiento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setDialog({ type: "mensaje", user })
                                  }
                                >
                                  <Send className="size-4 mr-2" />
                                  Enviar mensaje
                                </DropdownMenuItem>
                              </>
                            )}
                            {showToggle && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setDialog({ type: "toggle", user })
                                  }
                                >
                                  {user.is_active ? (
                                    <>
                                      <UserX className="size-4 mr-2" />
                                      Desactivar
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="size-4 mr-2" />
                                      Reactivar
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </>
                            )}
                            {showDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setDialog({ type: "delete", user })
                                  }
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── CREATE DIALOG ────────────────────────────────────────────────── */}
      <Dialog
        open={dialog.type === "create"}
        onOpenChange={(o) => !o && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo administrador</DialogTitle>
            <DialogDescription>
              Crea una cuenta de administrador. El rol se asigna automáticamente
              como &quot;Administrador&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="adm-nombre">Nombre *</Label>
                <Input
                  id="adm-nombre"
                  placeholder="Juan"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-apellido">Apellido *</Label>
                <Input
                  id="adm-apellido"
                  placeholder="Pérez"
                  value={form.apellido}
                  onChange={(e) =>
                    setForm({ ...form, apellido: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-cedula">Cédula</Label>
                <CedulaInput
                  id="adm-cedula"
                  value={form.cedula}
                  onChange={(v) => setForm({ ...form, cedula: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-telefono">Teléfono *</Label>
                <PhoneInput
                  id="adm-telefono"
                  value={form.telefono}
                  onChange={(v) => setForm({ ...form, telefono: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-email">Correo electrónico *</Label>
                <Input
                  id="adm-email"
                  type="email"
                  placeholder="admin@ejemplo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-username">Nombre de usuario *</Label>
                <Input
                  id="adm-username"
                  placeholder="jperez"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-limite">Límite de subusuarios</Label>
                <Input
                  id="adm-limite"
                  type="number"
                  min={0}
                  placeholder="Sin límite"
                  value={form.limiteSubusuarios}
                  onChange={(e) =>
                    setForm({ ...form, limiteSubusuarios: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-password">Contraseña *</Label>
              <Input
                id="adm-password"
                type="password"
                placeholder="Mínimo 10 caracteres"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Crear administrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ──────────────────────────────────────────────────── */}
      {dialog.type === "edit" && (
        <Dialog open onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog.user.id === currentUserId
                  ? "Editar mi perfil"
                  : `Editar — ${dialog.user.full_name ?? dialog.user.email}`}
              </DialogTitle>
              <DialogDescription>
                {dialog.user.id === currentUserId
                  ? "Actualiza tus datos de contacto. Los cambios son efectivos de inmediato."
                  : `Modifica los datos de ${dialog.user.full_name ?? dialog.user.email}. La contraseña se cambia con un enlace por correo.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="adm-nombre">Nombre *</Label>
                  <Input
                    id="adm-nombre"
                    placeholder="Juan"
                    value={form.nombre}
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-apellido">Apellido *</Label>
                  <Input
                    id="adm-apellido"
                    placeholder="Pérez"
                    value={form.apellido}
                    onChange={(e) =>
                      setForm({ ...form, apellido: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-cedula">Cédula</Label>
                  <Input
                    id="adm-cedula"
                    placeholder="001-0000000-0"
                    value={form.cedula}
                    onChange={(e) =>
                      setForm({ ...form, cedula: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-telefono">Teléfono *</Label>
                  <Input
                    id="adm-telefono"
                    placeholder="809-000-0000"
                    value={form.telefono}
                    onChange={(e) =>
                      setForm({ ...form, telefono: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-email">Correo electrónico *</Label>
                  <Input
                    id="adm-email"
                    type="email"
                    placeholder="admin@ejemplo.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-username">Nombre de usuario *</Label>
                  <Input
                    id="adm-username"
                    placeholder="jperez"
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adm-limite-edit">Límite de subusuarios</Label>
                  <Input
                    id="adm-limite-edit"
                    type="number"
                    min={0}
                    placeholder="Sin límite"
                    value={form.limiteSubusuarios}
                    onChange={(e) =>
                      setForm({ ...form, limiteSubusuarios: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleEdit(dialog.user.id)}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── TOGGLE DIALOG ────────────────────────────────────────────────── */}
      {dialog.type === "toggle" && (
        <Dialog open onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog.user.is_active
                  ? "Desactivar cuenta"
                  : "Reactivar cuenta"}
              </DialogTitle>
              <DialogDescription>
                {dialog.user.is_active
                  ? `¿Deseas desactivar la cuenta de ${dialog.user.full_name ?? dialog.user.email}? El usuario no podrá iniciar sesión.`
                  : `¿Deseas reactivar la cuenta de ${dialog.user.full_name ?? dialog.user.email}?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant={dialog.user.is_active ? "destructive" : "default"}
                onClick={() => handleToggle(dialog.user)}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                {dialog.user.is_active ? "Desactivar" : "Reactivar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── DELETE DIALOG ────────────────────────────────────────────────── */}
      {dialog.type === "delete" && (
        <Dialog open onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar administrador</DialogTitle>
              <DialogDescription>
                Esta acción es irreversible. Se eliminará permanentemente la
                cuenta de{" "}
                <strong>{dialog.user.full_name ?? dialog.user.email}</strong> y
                todos sus datos de acceso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(dialog.user.id)}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Eliminar definitivamente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── RESET PASSWORD DIALOG ────────────────────────────────────────── */}
      {dialog.type === "reset_password" && (
        <Dialog open onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog.user.id === currentUserId
                  ? "Restablecer mi contraseña"
                  : "Restablecer contraseña"}
              </DialogTitle>
              <DialogDescription>
                Se enviará un email de recuperación a{" "}
                <strong>{dialog.user.email}</strong>. El usuario podrá
                establecer una nueva contraseña desde el enlace recibido.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleResetPassword(dialog.user)}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Enviar email de recuperación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MANTENIMIENTO (§21) ──────────────────────────────────────────── */}
      {dialog.type === "mantenimiento" && (
        <Dialog open onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Mantenimiento — {dialog.user.full_name ?? dialog.user.email}
              </DialogTitle>
            </DialogHeader>

            {/* Resumen de un vistazo: el estado responde "¿ha pagado?" y las
                dos fechas dicen desde cuando y hasta cuando. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
              <Badge
                variant={
                  MANTENIMIENTO_UI[
                    dialog.user.mantenimiento?.estado ?? "PENDIENTE"
                  ].variant
                }
              >
                {
                  MANTENIMIENTO_UI[
                    dialog.user.mantenimiento?.estado ?? "PENDIENTE"
                  ].label
                }
              </Badge>
              <span className="text-muted-foreground">
                Último pago:{" "}
                <span className="font-medium text-foreground">
                  {fmtDateShort(dialog.user.mantenimiento?.ultimo_pago ?? null)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Próximo:{" "}
                <span className="font-medium text-foreground">
                  {fmtDateShort(
                    dialog.user.mantenimiento?.proximo_pago ?? null,
                  )}
                </span>
              </span>
            </div>

            <div className="space-y-4 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mant-dia">Día de pago</Label>
                  <Input
                    id="mant-dia"
                    type="date"
                    value={mant.diaPagoFecha}
                    onChange={(e) =>
                      setMant({ ...mant, diaPagoFecha: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mant-monto">Monto</Label>
                  <CurrencyInput
                    id="mant-monto"
                    placeholder="0.00"
                    value={mant.monto}
                    onChange={(v) => setMant({ ...mant, monto: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mant-proximo">Próximo pago</Label>
                  <Input
                    id="mant-proximo"
                    type="date"
                    value={mant.proximoPago}
                    onChange={(e) =>
                      setMant({ ...mant, proximoPago: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mant-estado">Estado</Label>
                  <Select
                    value={mant.estado || "AUTO"}
                    onValueChange={(v) => setMant({ ...mant, estado: v })}
                  >
                    <SelectTrigger id="mant-estado" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    {/* Solo dos opciones: "Al día", "Pendiente" y "Vencido"
                        los deduce el servidor de las fechas y los pagos, asi
                        que ofrecerlos a mano solo serviria para contradecir la
                        realidad. Lo unico que es una decision es eximir. */}
                    <SelectContent>
                      <SelectItem value="AUTO">Automático</SelectItem>
                      <SelectItem value="PRUEBA">Mes de prueba</SelectItem>
                      <SelectItem value="EXENTO">Exento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="mb-2 text-sm font-medium text-foreground">
                  Registrar pago
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pago-monto">Monto</Label>
                    <CurrencyInput
                      id="pago-monto"
                      placeholder="0.00"
                      value={pago.monto}
                      onChange={(v) => setPago({ ...pago, monto: v })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pago-fecha">Fecha</Label>
                    <Input
                      id="pago-fecha"
                      type="date"
                      value={pago.fechaPago}
                      onChange={(e) =>
                        setPago({ ...pago, fechaPago: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  disabled={loading || !pago.monto}
                  onClick={() => handleRegistrarPago(dialog.user.id)}
                >
                  {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                  Registrar pago
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={loading}
              >
                Cerrar
              </Button>
              <Button
                onClick={() => handleGuardarMantenimiento(dialog.user.id)}
                disabled={loading}
              >
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Guardar configuración
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── MENSAJE PERSONALIZADO (§23) ──────────────────────────────────── */}
      {dialog.type === "mensaje" && (
        <Dialog open onOpenChange={(o) => !o && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Mensaje para {dialog.user.full_name ?? dialog.user.email}
              </DialogTitle>
              <DialogDescription>
                Se le mostrará al iniciar sesión.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="msg-titulo">Título</Label>
                <Input
                  id="msg-titulo"
                  placeholder="Recordatorio de mantenimiento"
                  value={mensaje.titulo}
                  onChange={(e) =>
                    setMensaje({ ...mensaje, titulo: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="msg-cuerpo">Mensaje</Label>
                <Textarea
                  id="msg-cuerpo"
                  rows={4}
                  placeholder="Recuerda realizar tu pago antes del día 15."
                  value={mensaje.cuerpo}
                  onChange={(e) =>
                    setMensaje({ ...mensaje, cuerpo: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="msg-tipo">Tipo</Label>
                  <Select
                    value={mensaje.tipo}
                    onValueChange={(v) => setMensaje({ ...mensaje, tipo: v })}
                  >
                    <SelectTrigger id="msg-tipo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INFO">Informativo</SelectItem>
                      <SelectItem value="ADVERTENCIA">Advertencia</SelectItem>
                      <SelectItem value="URGENTE">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="msg-expira">Caduca el</Label>
                  <Input
                    id="msg-expira"
                    type="date"
                    value={mensaje.expiraEn}
                    onChange={(e) =>
                      setMensaje({ ...mensaje, expiraEn: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDialog}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleEnviarMensaje(dialog.user.id)}
                disabled={loading || !mensaje.titulo || !mensaje.cuerpo}
              >
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Enviar mensaje
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
