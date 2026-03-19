import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  try {
    // Verificar que supabase esté configurado
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase no está configurado correctamente" }, 
        { status: 500 }
      )
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        type,
        phone_or_email,
        subject,
        content,
        notification_type,
        status,
        sent_at,
        created_at,
        clients (
          name
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const result = (data ?? []).map((n: any) => ({
      id: n.id,
      client_name: n.clients?.name ?? "",
      type: n.type,
      phone_or_email: n.phone_or_email,
      subject: n.subject,
      content: n.content,
      notification_type: n.notification_type,
      status: n.status,
      sent_at: n.sent_at,
      created_at: n.created_at,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error en /api/notifications:", error)
    return NextResponse.json({ error: "Error obteniendo notificaciones" }, { status: 500 })
  }
}
