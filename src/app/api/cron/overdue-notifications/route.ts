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
    const todayString = today.toISOString().split("T")[0]

    // Obtener pagos vencidos que no han sido notificados hoy
    const { data: overduePayments, error } = await supabase
      .from("payments")
      .select(`
        id,
        loan_id,
        due_date,
        amount_due,
        status,
        loans (
          id,
          client_id,
          status,
          clients (
            id,
            name,
            phone
          )
        )
      `)
      .lt("due_date", todayString)
      .in("status", ["pendiente", "vencido", "mora"])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let sentCount = 0
    const results = []

    for (const payment of overduePayments || []) {
      const loan = (payment as any).loans
      if (!loan) continue

      // No enviar si el préstamo está en estados especiales
      const excludedStatuses = ["en revisión", "cancelado", "completado"]
      if (excludedStatuses.includes(loan.status?.toLowerCase())) {
        continue
      }

      // Verificar si ya se envió notificación de mora hoy
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("notification_type", "overdue")
        .gte(
          "sent_at",
          new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        )
        .single()

      if (existingNotif) {
        continue
      }

      const clientName = (loan.clients as any)?.name || "Cliente"
      const phone = (loan.clients as any)?.phone

      // Saltar si el cliente no tiene teléfono registrado
      if (!phone) {
        console.log(`Cliente ${clientName} no tiene teléfono registrado`)
        continue
      }

      const daysOverdue = Math.floor((today.getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24))

      // Determinar mensaje según días de mora
      let statusType = "overdue"
      let statusMessage = `Pago vencido hace ${daysOverdue} ${daysOverdue === 1 ? "día" : "días"}`
      let content = ""

      if (daysOverdue <= 7) {
        statusMessage = "Pago vencido"
        content = `Estimado/a ${clientName}, su pago se encuentra vencido desde hace ${daysOverdue} ${daysOverdue === 1 ? "día" : "días"}. Por favor regularice su situación lo antes posible. Monto pendiente: $${payment.amount_due}`
      } else if (daysOverdue <= 30) {
        statusType = "mora"
        statusMessage = "En mora"
        content = `URGENTE: Estimado/a ${clientName}, su pago está en mora hace ${daysOverdue} días. Esto puede afectar su historial crediticio. Por favor pague inmediatamente. Monto: $${payment.amount_due}`
      } else {
        statusType = "severe_mora"
        statusMessage = "Mora severa"
        content = `⚠️ ALERTA CRÍTICA: Estimado/a ${clientName}, su pago está en mora crítica hace ${daysOverdue} días. Contáctenos inmediatamente para evitar acciones legales. Monto: $${payment.amount_due}`
      }

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
              subject: `Alerta de pago: ${statusMessage}`,
              content,
              type: "whatsapp",
              notificationType: statusType,
            }),
          }
        )

        if (res.ok) {
          sentCount++
          results.push({
            loanId: loan.id,
            paymentId: payment.id,
            daysOverdue,
            status: "sent",
          })
        } else {
          results.push({
            loanId: loan.id,
            paymentId: payment.id,
            daysOverdue,
            status: "failed",
          })
        }
      } catch (err) {
        console.error(`Error enviando notificación de mora para pago ${payment.id}:`, err)
        results.push({
          loanId: loan.id,
          paymentId: payment.id,
          daysOverdue,
          status: "failed",
        })
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Se enviaron ${sentCount} notificaciones de mora/vencimiento`,
      results,
    })
  } catch (error) {
    console.error("Overdue cron error:", error)
    return NextResponse.json({ error: "Error en cron job" }, { status: 500 })
  }
}
