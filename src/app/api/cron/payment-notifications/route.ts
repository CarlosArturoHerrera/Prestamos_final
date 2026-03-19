import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  // Verificar token de seguridad
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const today = new Date()
    const currentDay = today.getDate()

    // Obtener todos los préstamos activos con sus clientes
    const { data: loans, error } = await supabase
      .from("loans")
      .select(`
        id,
        client_id,
        principal,
        status,
        payment_days,
        clients (
          id,
          name,
          phone
        )
      `)
      .in("status", ["activo", "pendiente"])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let sentCount = 0
    const results = []

    for (const loan of loans || []) {
      const paymentDaysStr = loan.payment_days || "15,30"
      const paymentDays = paymentDaysStr.split(",").map((d: string) => Number(d.trim()))

      // Verificar si hoy es un día de pago o está cerca
      const notificationDays: Record<number, string> = {}

      for (const payDay of paymentDays) {
        notificationDays[payDay] = "payment_day" // Día de pago
        notificationDays[Math.max(1, payDay - 3)] = "3_days_before" // 3 días antes
        notificationDays[Math.max(1, payDay - 1)] = "1_day_before" // 1 día antes
      }

      // Verificar si hoy es un día de notificación
      const notificationType = notificationDays[currentDay]
      if (!notificationType) {
        continue
      }

      const clientName = (loan.clients as any)?.name || "Cliente"
      const phone = (loan.clients as any)?.phone

      // Saltar si el cliente no tiene teléfono registrado
      if (!phone) {
        console.log(`Cliente ${clientName} no tiene teléfono registrado`)
        continue
      }

      // Verificar si ya se envió notificación de este tipo hoy
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("notification_type", notificationType)
        .gte(
          "sent_at",
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        )
        .single()

      if (existingNotif) {
        // Ya existe notificación de este tipo hoy
        continue
      }

      // Determinar mensaje según el tipo de notificación
      const messages: Record<string, { subject: string; content: string }> = {
        payment_day: {
          subject: "Recordatorio: Hoy es tu día de pago",
          content: `Estimado/a ${clientName}, le recordamos que hoy es el día de pago. Por favor realice el pago de su cuota de $${loan.principal}. Muchas gracias.`,
        },
        "1_day_before": {
          subject: "Recordatorio: Tu pago vence mañana",
          content: `Estimado/a ${clientName}, le recordamos que mañana vence su pago. Por favor realícelo a tiempo para evitar inconvenientes.`,
        },
        "3_days_before": {
          subject: "Recordatorio: Tu pago vence en 3 días",
          content: `Estimado/a ${clientName}, le recordamos que su pago vence en 3 días. Prepare los fondos necesarios.`,
        },
      }

      const message = messages[notificationType]
      if (!message) continue

      // Enviar notificación
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

      try {
        const res = await fetch(
          `${baseUrl}/api/notifications/send`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              loanId: loan.id,
              clientId: loan.client_id,
              phone,
              subject: message.subject,
              content: message.content,
              type: "whatsapp",
            }),
          }
        )

        if (res.ok) {
          sentCount++
          results.push({
            loanId: loan.id,
            type: notificationType,
            status: "sent",
          })
        } else {
          results.push({
            loanId: loan.id,
            type: notificationType,
            status: "failed",
          })
        }
      } catch (err) {
        console.error(`Error enviando notificación para préstamo ${loan.id}:`, err)
        results.push({
          loanId: loan.id,
          type: notificationType,
          status: "failed",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Se enviaron ${sentCount} notificaciones`,
      results,
    })
  } catch (error) {
    console.error("Cron error:", error)
    return NextResponse.json({ error: "Error en cron job" }, { status: 500 })
  }
}
