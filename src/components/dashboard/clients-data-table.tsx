"use client"

import { useState, useEffect } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronLeft, ChevronRight, Eye, Edit2, Trash2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Client } from "@/lib/types/client"
import { toast } from "sonner"

interface Segment {
  id: number
  name: string
}

interface ClientsDataTableProps {
  data: Client[]
  searchTerm: string
  onSearchChange: (term: string) => void
  onDeleteClient: (id: string) => void
  onUpdateClient: (client: Client) => void
  isLoading?: boolean
}

export function ClientsDataTable({
  data,
  searchTerm,
  onSearchChange,
  onDeleteClient,
  onUpdateClient,
  isLoading = false,
}: ClientsDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewClient, setViewClient] = useState<Client | null>(null)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [, setEditStatus] = useState<string>("")
  const [, setEditRisk] = useState<Client["riskLevel"]>("Estable")
  const [editLocation, setEditLocation] = useState<string>("")
  const [segments, setSegments] = useState<Segment[]>([])

  useEffect(() => {
    const loadSegments = async () => {
      try {
        const response = await fetch("/api/segments")
        if (response.ok) {
          const data = await response.json()
          setSegments(data)
        }
      } catch (error) {
        console.error("Error loading segments:", error)
      }
    }
    loadSegments()
  }, [])

  const getRiskBadgeVariant = (riskLevel: string) => {
    switch (riskLevel) {
      case "Estable":
        return "default"
      case "Vigilancia":
        return "secondary"
      case "Alerta":
        return "outline"
      case "Crítico":
        return "destructive"
      default:
        return "default"
    }
  }

  const getStatusColor = (status: string) => {
    if (status.includes("Al día")) return "text-primary"
    if (status.includes("seguimiento")) return "text-secondary-foreground"
    if (status.includes("Atraso")) return "text-destructive"
    return "text-muted-foreground"
  }

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="gap-2"
        >
          Nombre
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "segment",
      header: "Segmento",
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue("segment")}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <span className={`font-medium ${getStatusColor(row.getValue("status"))}`}>
          {row.getValue("status")}
        </span>
      ),
    },
    {
      accessorKey: "riskLevel",
      header: "Nivel de riesgo",
      cell: ({ row }) => {
        const risk = row.getValue("riskLevel") as string
        return (
          <Badge variant={getRiskBadgeVariant(risk)}>
            {risk}
          </Badge>
        )
      },
    },
    {
      accessorKey: "lastPayment",
      header: "Último pago",
      cell: ({ row }) => {
        const date = new Date(row.getValue("lastPayment"))
        return <span className="text-sm text-muted-foreground">{date.toLocaleDateString("es-ES")}</span>
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewClient(row.original)}
            title="Ver detalles"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditClient(row.original)
              setEditStatus(row.original.status)
              setEditRisk(row.original.riskLevel)
              setEditLocation(row.original.location ?? "")
            }}
            title="Editar"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteId(row.original.id)}
            title="Eliminar"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, segmento o email"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  Cargando clientes...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Sin resultados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="text-muted-foreground">
          {table.getFilteredRowModel().rows.length} de {data.length} clientes
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="text-xs text-muted-foreground px-2 py-2">
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null}>
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel onClick={() => setDeleteId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDeleteClient(deleteId)
                  setDeleteId(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Client Dialog */}
      <Dialog open={viewClient !== null} onOpenChange={() => setViewClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalles del cliente</DialogTitle>
            <DialogDescription>Información completa del cliente</DialogDescription>
          </DialogHeader>
          {viewClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="id" className="text-xs font-semibold text-muted-foreground">ID</label>
                  <p className="font-medium">{viewClient.id}</p>
                </div>
                <div>
                  <label htmlFor="name" className="text-xs font-semibold text-muted-foreground">Nombre</label>
                  <p className="font-medium">{viewClient.name}</p>
                </div>
                <div className="col-span-2">
                  <label htmlFor="email" className="text-xs font-semibold text-muted-foreground">Email</label>
                  <p className="font-medium text-sm">{viewClient.email}</p>
                </div>
                <div className="col-span-2">
                  <label htmlFor="phone" className="text-xs font-semibold text-muted-foreground">Teléfono</label>
                  <p className="font-medium">{viewClient.phone}</p>
                </div>
                <div>
                  <label htmlFor="segment" className="text-xs font-semibold text-muted-foreground">Segmento</label>
                  <p className="font-medium">{viewClient.segment}</p>
                </div>
                <div>
                  <label htmlFor="status" className="text-xs font-semibold text-muted-foreground">Estado</label>
                  <p className={`font-medium ${getStatusColor(viewClient.status)}`}>{viewClient.status}</p>
                </div>
                <div>
                  <label htmlFor="riskLevel" className="text-xs font-semibold text-muted-foreground">Riesgo</label>
                  <Badge variant={getRiskBadgeVariant(viewClient.riskLevel)} className="mt-1 ml-1">
                    {viewClient.riskLevel}
                  </Badge>
                </div>
                <div>
                  <label htmlFor="joinDate" className="text-xs font-semibold text-muted-foreground">Fecha de registro</label>
                  <p className="font-medium text-sm"> 
                    {new Date(viewClient.joinDate).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div>
                  <label htmlFor="lastPayment" className="text-xs font-semibold text-muted-foreground">Último pago</label>
                  <p className="font-medium text-sm">
                    {new Date(viewClient.lastPayment).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClient !== null} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Actualiza la información del cliente</DialogDescription>
          </DialogHeader>
          {editClient && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">Nombre</label>
                <Input
                  value={editClient.name}
                  onChange={(e) => setEditClient({ ...editClient, name: e.target.value })}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="phone" className="text-sm font-medium">Teléfono</label>
                <Input
                  value={editClient.phone}
                  onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })}
                  placeholder="+1 809 ..."
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editClient.email}
                  onChange={(e) => setEditClient({ ...editClient, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="segment" className="text-sm font-medium">Perfil</label>
                <Select value={editClient.segment} onValueChange={(value) => setEditClient({ ...editClient, segment: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((seg) => (
                      <SelectItem key={seg.id} value={seg.name}>
                        {seg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="location" className="text-sm font-medium">Ubicación</label>
                <Input
                  value={editLocation || editClient.location}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Ciudad, provincia"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="notes" className="text-sm font-medium">Notas</label>
                <textarea
                  value={editClient.notes}
                  onChange={(e) => setEditClient({ ...editClient, notes: e.target.value })}
                  placeholder="Información adicional..."
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                  rows={3}
                />
              </div>
              <div className="pt-4 flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditClient(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editClient) return
                    try {
                      const response = await fetch("/api/clients/update", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          id: editClient.id,
                          name: editClient.name,
                          phone: editClient.phone,
                          email: editClient.email,
                          segment: editClient.segment,
                          location: editLocation,
                          notes: editClient.notes,
                        }),
                      })

                      if (!response.ok) {
                        const error = await response.json()
                        throw new Error(error.error || "Error al actualizar cliente")
                      }

                      const updatedClient = await response.json()
                      onUpdateClient(updatedClient)
                      setEditClient(null)
                      toast.success("Cliente actualizado exitosamente")
                    } catch (error) {
                      console.error(error)
                      const message = error instanceof Error ? error.message : "Error al actualizar cliente"
                      toast.error(message)
                    }
                  }}
                >
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
