"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCog,
  UserX,
  XCircle,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"
import type { AdminUser } from "@/app/(dashboard)/admin/users/page"
import { getRoleLabel, getRoleBadgeVariant } from "@/lib/roles"
import {
  canShowRowActions,
  canToggleUser,
  canDeleteUser,
  type AuthActor,
  type AuthTarget,
} from "@/lib/authorization"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface UsersTableProps {
  users: AdminUser[]
  currentUserId: string
  currentUserRole: "super_admin" | "admin"
}

type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; user: AdminUser }
  | { type: "delete"; user: AdminUser }
  | { type: "toggle"; user: AdminUser }
  | { type: "reset_password"; user: AdminUser }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "dd MMM yyyy HH:mm", { locale: es })
  } catch {
    return "—"
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
  })
  return res.json()
}

// ── Main component ────────────────────────────────────────────────────────────

export function UsersTable({
  users: initialUsers,
  currentUserId,
  currentUserRole,
}: UsersTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<DialogState>({ type: "none" })
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all")

  // Create form state
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createName, setCreateName] = useState("")

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")

  const [loading, setLoading] = useState(false)

  // Actor = the currently logged-in user (always super_admin on this page)
  const actor: AuthActor = { userId: currentUserId, role: currentUserRole }

  function closeDialog() {
    setDialog({ type: "none" })
    setCreateEmail("")
    setCreatePassword("")
    setCreateName("")
  }

  function openEdit(user: AdminUser) {
    setEditName(user.full_name ?? "")
    setEditEmail(user.email ?? "")
    setDialog({ type: "edit", user })
  }

  const refresh = () =>
    startTransition(() => {
      router.refresh()
    })

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = initialUsers.filter((u) => {
    const matchSearch =
      !search ||
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(search.toLowerCase())

    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && u.is_active) ||
      (filterStatus === "inactive" && !u.is_active)

    return matchSearch && matchStatus
  })

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!createEmail || !createPassword) {
      toast.error("Email y contraseña son requeridos")
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch("/api/admin/users", "POST", {
        email: createEmail,
        password: createPassword,
        fullName: createName || undefined,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Administrador creado correctamente")
        closeDialog()
        refresh()
      }
    } catch {
      toast.error("Error de red")
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(userId: string) {
    setLoading(true)
    try {
      const body: Record<string, string> = {}
      if (editName) body.fullName = editName
      if (editEmail) body.email = editEmail

      const res = await apiFetch(`/api/admin/users/${userId}`, "PATCH", body)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Usuario actualizado")
        closeDialog()
        refresh()
      }
    } catch {
      toast.error("Error de red")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(user: AdminUser) {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, "PATCH", {
        isActive: !user.is_active,
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(user.is_active ? "Cuenta desactivada" : "Cuenta reactivada")
        closeDialog()
        refresh()
      }
    } catch {
      toast.error("Error de red")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(userId: string) {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, "DELETE")
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Administrador eliminado")
        closeDialog()
        refresh()
      }
    } catch {
      toast.error("Error de red")
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(user: AdminUser) {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, "PATCH", {
        action: "reset_password",
      })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Email de recuperación enviado")
        closeDialog()
      }
    } catch {
      toast.error("Error de red")
    } finally {
      setLoading(false)
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
                {s === "all" ? "Todos" : s === "active" ? "Activos" : "Inactivos"}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
          <Button size="sm" onClick={() => setDialog({ type: "create" })}>
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
          Activos: <strong className="text-green-600">{initialUsers.filter((u) => u.is_active).length}</strong>
        </span>
        <span className="text-muted-foreground">
          Inactivos: <strong className="text-red-500">{initialUsers.filter((u) => !u.is_active).length}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No se encontraron usuarios
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => {
                const isCurrentUser = user.id === currentUserId
                const isSuperAdminRow = user.role === "super_admin"
                const target: AuthTarget = { id: user.id, role: user.role }

                // Decisions driven by centralized authorization module
                const showActions  = canShowRowActions(actor, target)
                const showToggle   = canToggleUser(actor, target)
                const showDelete   = canDeleteUser(actor, target)

                return (
                  <TableRow
                    key={user.id}
                    className={!user.is_active ? "opacity-60" : undefined}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.full_name ?? <span className="text-muted-foreground italic">Sin nombre</span>}
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Tú</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {isSuperAdminRow && <ShieldAlert className="size-3 mr-1" />}
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
                    <TableCell className="text-muted-foreground text-sm">
                      {fmtDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fmtDate(user.last_sign_in_at)}
                    </TableCell>
                    <TableCell>
                      {showActions && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <UserCog className="size-4 mr-2" />
                              {isCurrentUser ? "Editar mi perfil" : "Editar"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDialog({ type: "reset_password", user })}
                            >
                              <KeyRound className="size-4 mr-2" />
                              {isCurrentUser ? "Restablecer mi contraseña" : "Restablecer contraseña"}
                            </DropdownMenuItem>
                            {showToggle && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDialog({ type: "toggle", user })}
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
                                  onClick={() => setDialog({ type: "delete", user })}
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
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── CREATE DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={dialog.type === "create"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo administrador</DialogTitle>
            <DialogDescription>
              Crea una cuenta de administrador. El rol se asigna automáticamente como
              &quot;Administrador&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Nombre completo</Label>
              <Input
                id="create-name"
                placeholder="Juan Pérez"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="admin@ejemplo.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-password">Contraseña temporal *</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El usuario deberá cambiar su contraseña al iniciar sesión.
              </p>
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
                  ? "Actualiza tu nombre o correo electrónico. Los cambios son efectivos de inmediato."
                  : `Modifica el nombre o email de ${dialog.user.full_name ?? dialog.user.email}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nombre completo</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={() => handleEdit(dialog.user.id)} disabled={loading}>
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
                {dialog.user.is_active ? "Desactivar cuenta" : "Reactivar cuenta"}
              </DialogTitle>
              <DialogDescription>
                {dialog.user.is_active
                  ? `¿Deseas desactivar la cuenta de ${dialog.user.full_name ?? dialog.user.email}? El usuario no podrá iniciar sesión.`
                  : `¿Deseas reactivar la cuenta de ${dialog.user.full_name ?? dialog.user.email}?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={loading}>
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
                Esta acción es irreversible. Se eliminará permanentemente la cuenta de{" "}
                <strong>{dialog.user.full_name ?? dialog.user.email}</strong> y todos sus datos de
                acceso.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={loading}>
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
              <Button variant="outline" onClick={closeDialog} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={() => handleResetPassword(dialog.user)} disabled={loading}>
                {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                Enviar email de recuperación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
