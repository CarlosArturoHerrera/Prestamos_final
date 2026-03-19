"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, Mail, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

type Notification = {
  id: string
  client_name: string
  type: string
  phone_or_email: string
  subject: string
  content: string
  notification_type: string
  status: string
  sent_at: string | null
  created_at: string
}

const getTypeIcon = (type: string) => {
  return type === "whatsapp" ? (
    <MessageCircle className="h-4 w-4 text-primary" />
  ) : (
    <Mail className="h-4 w-4 text-secondary" />
  )
}

const getTypeLabel = (type: string) => {
  return type === "whatsapp" ? "WhatsApp" : "Correo"
}

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; variant: any }> = {
    pending: { label: "Pendiente", variant: "outline" },
    sent: { label: "Enviado", variant: "outline" },
    delivered: { label: "Entregado", variant: "secondary" },
    read: { label: "Leído", variant: "default" },
    failed: { label: "Fallido", variant: "destructive" },
  }
  return statusMap[status] || { label: status, variant: "outline" }
}

export function NotificationsTab() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || "No se pudieron cargar las notificaciones")
        }
        const data: Notification[] = await res.json()
        setNotifications(data)
        setError(null)
      } catch (error) {
        console.error("Error cargando notificaciones:", error)
        const errorMessage = error instanceof Error ? error.message : "Error desconocido"
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadNotifications()
  }, [])

  const stats = useMemo(() => {
    const total = notifications.length
    const whatsapp = notifications.filter((n) => n.type === "whatsapp").length
    const email = notifications.filter((n) => n.type === "email").length
    const delivered = notifications.filter((n) => n.status === "delivered").length
    return { total, whatsapp, email, delivered }
  }, [notifications])

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Notificaciones</h2>
        <p className="text-muted-foreground mt-2">
          Historial de notificaciones enviadas a tus clientes por WhatsApp y correo
        </p>
      </div>

      {/* Error Message - Ya se muestra en toast */}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Notificaciones</p>
              <p className="text-3xl font-bold mt-2">{stats.total}</p>
            </div>
            <div className="metric-icon"><Bell className="h-5 w-5" /></div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">WhatsApp</p>
              <p className="text-3xl font-bold mt-2">{stats.whatsapp}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total ? ((stats.whatsapp / stats.total) * 100).toFixed(0) : 0}% del total
              </p>
            </div>
            <div className="metric-icon"><MessageCircle className="h-5 w-5" /></div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Correo Electrónico</p>
              <p className="text-3xl font-bold mt-2">{stats.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total ? ((stats.email / stats.total) * 100).toFixed(0) : 0}% del total
              </p>
            </div>
            <div className="metric-icon"><Mail className="h-5 w-5" /></div>
          </div>
        </Card>

        <Card className="stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Entregadas</p>
              <p className="text-3xl font-bold mt-2">{stats.delivered}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total ? ((stats.delivered / stats.total) * 100).toFixed(0) : 0}% entregadas
              </p>
            </div>
            <div className="metric-icon"><Bell className="h-5 w-5" /></div>
          </div>
        </Card>
      </div>

      {/* Notifications Table */}
      <Card className="animate-in fade-in slide-in-from-bottom-6 duration-700">
        <CardHeader>
          <CardTitle>Historial de Notificaciones</CardTitle>
          <CardDescription>
            Detalle de todas las notificaciones enviadas a tus clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="h-10 px-4 text-left align-middle font-medium">Cliente</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Medio</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Contacto</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Asunto</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Fecha</th>
                  <th className="h-10 px-4 text-center align-middle font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="h-14 px-4 text-center text-muted-foreground">Cargando notificaciones...</td>
                  </tr>
                ) : notifications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-14 px-4 text-center text-muted-foreground">Sin notificaciones</td>
                  </tr>
                ) : (
                  notifications.map((notification) => {
                    const statusBadge = getStatusBadge(notification.status)
                    const dateString = notification.sent_at || notification.created_at
                    const sentDate = dateString ? new Date(dateString) : new Date()
                    
                    // Validate date to prevent "Invalid time value" error
                    const isValidDate = !isNaN(sentDate.getTime())
                    const displayDate = isValidDate ? sentDate : new Date()
                    
                    return (
                      <tr
                        key={notification.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="h-14 px-4 align-middle font-medium">{notification.client_name || "-"}</td>
                        <td className="h-14 px-4 align-middle">
                          <div className="flex items-center justify-center gap-2">
                            {getTypeIcon(notification.type)}
                            <span className="text-xs">{getTypeLabel(notification.type)}</span>
                          </div>
                        </td>
                        <td className="h-14 px-4 align-middle text-sm text-muted-foreground">
                          {notification.phone_or_email}
                        </td>
                        <td className="h-14 px-4 align-middle max-w-xs">
                          <div className="truncate font-medium text-sm">{notification.subject}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {notification.content}
                          </div>
                        </td>
                        <td className="h-14 px-4 align-middle text-center text-xs">
                          <div>{format(displayDate, "dd/MM/yyyy", { locale: es })}</div>
                          <div className="text-muted-foreground">{format(displayDate, "HH:mm", { locale: es })}</div>
                        </td>
                        <td className="h-14 px-4 align-middle text-center">
                          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
