import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { NotificationItem } from "@/components/dashboard/segments-tabs"

export async function GET() {
  try {
    // Obtener notificaciones
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, subject, content, type, status, created_at, client_id")
      .order("created_at", { ascending: false })

    if (error) throw error

    // Obtener clientes
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")

    if (clientsError) throw clientsError

    // Mapear clientes
    const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c]))

    // Construir respuesta
    const result: NotificationItem[] = (notifications ?? []).map((notif: any) => {
      const client = clientMap.get(notif.client_id)
      const clientName = client?.name ?? "Cliente desconocido"

      return {
        title: notif.subject || "Notificación",
        client: clientName,
        detail: notif.content || "",
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error en /api/dashboard/notifications-segment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error cargando alertas" },
      { status: 500 }
    )
  }
}
