"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  KeyRound,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PermisosEditor } from "@/components/subusuarios/permisos-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CedulaInput } from "@/components/ui/cedula-input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchApi } from "@/lib/fetch-api";
import {
  DEFAULT_SUBUSER_PERMISSIONS,
  type PermissionCode,
} from "@/lib/permissions";

/**
 * Panel de SUBUSUARIOS de la organización (§13, §14, §20).
 *
 * Todas las llamadas van a /api/subusuarios, que determina la organización a
 * partir de la sesión del servidor. Este componente nunca envía un
 * `administrator_id`: no tendría efecto, porque el backend lo ignora (§15).
 */

export type Subusuario = {
  id: string;
  username: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  telefono: string | null;
  cedula: string | null;
  is_active: boolean;
  created_at: string;
  permisos: PermissionCode[];
};

type Dialogo =
  | { tipo: "ninguno" }
  | { tipo: "crear" }
  | { tipo: "editar"; sub: Subusuario }
  | { tipo: "permisos"; sub: Subusuario }
  | { tipo: "estado"; sub: Subusuario }
  | { tipo: "eliminar"; sub: Subusuario }
  | { tipo: "reset"; sub: Subusuario };

const FORM_VACIO = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  email: "",
  username: "",
  password: "",
};

function fecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy", { locale: es });
  } catch {
    return "—";
  }
}

export function SubusuariosPanel() {
  const [subusuarios, setSubusuarios] = useState<Subusuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: "ninguno" });
  const [form, setForm] = useState(FORM_VACIO);
  const [permisos, setPermisos] = useState<PermissionCode[]>([]);

  const cargar = async () => {
    const res = await fetchApi<{ subusuarios: Subusuario[] }>(
      "/api/subusuarios",
    );
    if (res.ok) setSubusuarios(res.data.subusuarios);
    else toast.error(res.message);
    setCargando(false);
  };

  // Sólo en el montaje: `cargar` se redefine en cada render, así que ponerlo
  // en las dependencias dispararía una recarga infinita.
  // biome-ignore lint/correctness/useExhaustiveDependencies: carga inicial única
  useEffect(() => {
    void cargar();
  }, []);

  const cerrar = () => {
    setDialogo({ tipo: "ninguno" });
    setForm(FORM_VACIO);
    setPermisos([]);
  };

  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setPermisos([...DEFAULT_SUBUSER_PERMISSIONS]);
    setDialogo({ tipo: "crear" });
  };

  const abrirEditar = (sub: Subusuario) => {
    setForm({
      nombre: sub.first_name ?? "",
      apellido: sub.last_name ?? "",
      cedula: sub.cedula ?? "",
      telefono: sub.telefono ?? "",
      email: sub.email ?? "",
      username: sub.username ?? "",
      password: "",
    });
    setDialogo({ tipo: "editar", sub });
  };

  const abrirPermisos = (sub: Subusuario) => {
    setPermisos([...sub.permisos]);
    setDialogo({ tipo: "permisos", sub });
  };

  // ── Acciones ──────────────────────────────────────────────────────────────

  const crear = async () => {
    setGuardando(true);
    const res = await fetchApi<{ message: string }>("/api/subusuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, permisos }),
    });
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Subusuario creado");
    cerrar();
    void cargar();
  };

  const guardarDatos = async (sub: Subusuario) => {
    setGuardando(true);
    const res = await fetchApi<{ message: string }>(
      `/api/subusuarios/${sub.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          cedula: form.cedula,
          telefono: form.telefono,
          email: form.email,
          username: form.username,
        }),
      },
    );
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Subusuario actualizado");
    cerrar();
    void cargar();
  };

  const guardarPermisos = async (sub: Subusuario) => {
    setGuardando(true);
    const res = await fetchApi<{ message: string }>(
      `/api/subusuarios/${sub.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permisos }),
      },
    );
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Permisos actualizados");
    cerrar();
    void cargar();
  };

  const cambiarEstado = async (sub: Subusuario) => {
    setGuardando(true);
    const res = await fetchApi<{ message: string }>(
      `/api/subusuarios/${sub.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sub.is_active }),
      },
    );
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      sub.is_active ? "Subusuario desactivado" : "Subusuario reactivado",
    );
    cerrar();
    void cargar();
  };

  const eliminar = async (sub: Subusuario) => {
    setGuardando(true);
    const res = await fetchApi<{ message: string }>(
      `/api/subusuarios/${sub.id}`,
      { method: "DELETE" },
    );
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Subusuario eliminado");
    cerrar();
    void cargar();
  };

  const resetPassword = async (sub: Subusuario) => {
    setGuardando(true);
    const res = await fetchApi<{ message: string }>(
      `/api/subusuarios/${sub.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password" }),
      },
    );
    setGuardando(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Correo de restablecimiento enviado");
    cerrar();
  };

  // ── Formulario reutilizable ───────────────────────────────────────────────

  const campos = (conCredenciales: boolean) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="su-nombre">Nombre</Label>
        <Input
          id="su-nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          disabled={guardando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-apellido">Apellido</Label>
        <Input
          id="su-apellido"
          value={form.apellido}
          onChange={(e) => setForm({ ...form, apellido: e.target.value })}
          disabled={guardando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-cedula">Cédula</Label>
        <CedulaInput
          id="su-cedula"
          value={form.cedula}
          onChange={(v) => setForm({ ...form, cedula: v })}
          disabled={guardando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-telefono">Teléfono</Label>
        <PhoneInput
          id="su-telefono"
          value={form.telefono}
          onChange={(v) => setForm({ ...form, telefono: v })}
          disabled={guardando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Correo electrónico</Label>
        <Input
          id="su-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          disabled={guardando}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-username">Nombre de usuario</Label>
        <Input
          id="su-username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          disabled={guardando}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      {conCredenciales && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="su-password">Contraseña</Label>
          <Input
            id="su-password"
            type="password"
            placeholder="Mínimo 10 caracteres"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={guardando}
            autoComplete="new-password"
          />
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {cargando
            ? "Cargando…"
            : `${subusuarios.length} subusuario${subusuarios.length === 1 ? "" : "s"}`}
        </p>
        <Button onClick={abrirCrear} className="gap-2">
          <PlusCircle className="size-4" />
          Nuevo subusuario
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden md:table-cell">Correo</TableHead>
              <TableHead className="hidden lg:table-cell">Permisos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Alta</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}

            {!cargando && subusuarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center">
                  <Users className="mx-auto mb-2 size-7 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">
                    Aún no tienes subusuarios
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Crea el primero para empezar.
                  </p>
                </TableCell>
              </TableRow>
            )}

            {subusuarios.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell>
                  <p className="font-medium text-foreground">
                    {sub.full_name ?? sub.username ?? "—"}
                  </p>
                  {sub.username && (
                    <p className="text-xs text-muted-foreground">
                      @{sub.username}
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {sub.email ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant="secondary" className="font-normal">
                    {sub.permisos.length}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={sub.is_active ? "default" : "outline"}>
                    {sub.is_active ? "Activo" : "Desactivado"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {fecha(sub.created_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Acciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => abrirEditar(sub)}>
                        <UserCog className="size-4" />
                        Editar datos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => abrirPermisos(sub)}>
                        <ShieldCheck className="size-4" />
                        Permisos
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDialogo({ tipo: "reset", sub })}
                      >
                        <KeyRound className="size-4" />
                        Enviar cambio de contraseña
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDialogo({ tipo: "estado", sub })}
                      >
                        <UserX className="size-4" />
                        {sub.is_active ? "Desactivar" : "Reactivar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDialogo({ tipo: "eliminar", sub })}
                      >
                        <Trash2 className="size-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Crear ── */}
      <Dialog
        open={dialogo.tipo === "crear"}
        onOpenChange={(o) => !o && cerrar()}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo subusuario</DialogTitle>
            <DialogDescription>
              Trabajará dentro de tu organización.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {campos(true)}
            <PermisosEditor
              seleccionados={permisos}
              onChange={setPermisos}
              disabled={guardando}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void crear()} disabled={guardando}>
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Crear subusuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Editar datos ── */}
      <Dialog
        open={dialogo.tipo === "editar"}
        onOpenChange={(o) => !o && cerrar()}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar subusuario</DialogTitle>
            <DialogDescription>Datos de la cuenta.</DialogDescription>
          </DialogHeader>

          {campos(false)}

          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                dialogo.tipo === "editar" && void guardarDatos(dialogo.sub)
              }
              disabled={guardando}
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Permisos ── */}
      <Dialog
        open={dialogo.tipo === "permisos"}
        onOpenChange={(o) => !o && cerrar()}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Permisos de{" "}
              {dialogo.tipo === "permisos"
                ? (dialogo.sub.full_name ?? dialogo.sub.username)
                : ""}
            </DialogTitle>
            <DialogDescription>Marca lo que puede hacer.</DialogDescription>
          </DialogHeader>

          <PermisosEditor
            seleccionados={permisos}
            onChange={setPermisos}
            disabled={guardando}
          />

          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                dialogo.tipo === "permisos" && void guardarPermisos(dialogo.sub)
              }
              disabled={guardando}
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Guardar permisos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Activar / desactivar ── */}
      <Dialog
        open={dialogo.tipo === "estado"}
        onOpenChange={(o) => !o && cerrar()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogo.tipo === "estado" && dialogo.sub.is_active
                ? "Desactivar subusuario"
                : "Reactivar subusuario"}
            </DialogTitle>
            <DialogDescription>
              {dialogo.tipo === "estado" && dialogo.sub.is_active
                ? "No podrá iniciar sesión. Sus datos se conservan."
                : "Volverá a poder iniciar sesión."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                dialogo.tipo === "estado" && void cambiarEstado(dialogo.sub)
              }
              disabled={guardando}
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Eliminar ── */}
      <Dialog
        open={dialogo.tipo === "eliminar"}
        onOpenChange={(o) => !o && cerrar()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar subusuario</DialogTitle>
            <DialogDescription>
              Se borra la cuenta de acceso de forma permanente. Los clientes,
              préstamos y registros que haya creado pertenecen a tu organización
              y NO se eliminan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                dialogo.tipo === "eliminar" && void eliminar(dialogo.sub)
              }
              disabled={guardando}
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Restablecer contraseña ── */}
      <Dialog
        open={dialogo.tipo === "reset"}
        onOpenChange={(o) => !o && cerrar()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar cambio de contraseña</DialogTitle>
            <DialogDescription>
              Se le enviará un enlace por correo para crear una contraseña
              nueva.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={() =>
                dialogo.tipo === "reset" && void resetPassword(dialogo.sub)
              }
              disabled={guardando}
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              Enviar correo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
