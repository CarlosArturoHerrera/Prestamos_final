import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

/**
 * CRON JOB TEMPORAL - ENVÍO DE NOTIFICACIONES
 * ============================================
 * Este cron job es temporal y debe ser eliminado después de las pruebas.
 * Envía todas las notificaciones pendientes al número: +1 (829) 461-2307
 * 
 * Horarios configurados (Santo Domingo, UTC-4):
 * - Hoy 24/01/2026 a las 4:50 PM
 * - Mañana 25/01/2026 a las 8:00 AM
 * 
 * TODO: ELIMINAR ESTE ARCHIVO Y SU CONFIGURACIÓN EN vercel.json DESPUÉS DE LAS PRUEBAS
 */

export async function GET(request: Request) {
  // Verificar token de seguridad
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const TEMP_PHONE = "+18294612307" // Número temporal para pruebas

  try {
    const today = new Date()
    const todayString = today.toISOString().split("T")[0]

    // Obtener todos los préstamos activos y sus pagos pendientes
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select(`
        id,
        client_id,
        principal,
        rate,
        status,
        payment_days,
        clients (
          id,
          name,
          phone
        )
      `)
      .in("status", ["activo", "pendiente"])

    if (loansError) {
      console.error("Error obteniendo préstamos:", loansError)
      return NextResponse.json({ error: loansError.message }, { status: 400 })
    }

    // Obtener pagos pendientes y vencidos
    const { data: payments, error: paymentsError } = await supabase
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
          clients (
            id,
            name
          )
        )
      `)
      .in("status", ["pendiente", "vencido", "mora"])
      .lte("due_date", todayString)

    if (paymentsError) {
      console.error("Error obteniendo pagos:", paymentsError)
    }

    let sentCount = 0
    const results = []
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

    // Enviar notificaciones de préstamos activos
    for (const loan of loans || []) {
      const clientName = (loan.clients as any)?.name || "Cliente"
      const clientPhone = (loan.clients as any)?.phone || "N/A"
      
      const paymentDaysStr = loan.payment_days || "15,30"
      const paymentDays = paymentDaysStr.split(",").map((d: string) => Number(d.trim()))
      
      const subject = "📊 Resumen de Préstamo Activo"
      const content = `Hola ${clientName}!\n\n` +
        `📋 Información del préstamo:\n` +
        `💰 Monto Principal: $${loan.principal}\n` +
        `📈 Tasa: ${loan.rate}%\n` +
        `📅 Días de pago: ${paymentDays.join(", ")}\n` +
        `📞 Teléfono registrado: ${clientPhone}\n\n` +
        `Estado: ${loan.status}\n\n` +
        `Esta es una notificación de prueba del sistema de gestión de préstamos.`

      try {
        const res = await fetch(`${baseUrl}/api/notifications/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loanId: loan.id,
            clientId: loan.client_id,
            phone: TEMP_PHONE,
            subject,
            content,
            type: "whatsapp",
          }),
        })

        if (res.ok) {
          sentCount++
          results.push({
            type: "loan_info",
            loanId: loan.id,
            clientName,
            status: "sent",
          })
        } else {
          const errorData = await res.json()
          results.push({
            type: "loan_info",
            loanId: loan.id,
            clientName,
            status: "failed",
            error: errorData.error || "Error desconocido",
          })
        }
      } catch (err) {
        console.error(`Error enviando notificación para préstamo ${loan.id}:`, err)
        results.push({
          type: "loan_info",
          loanId: loan.id,
          clientName,
          status: "error",
          error: err instanceof Error ? err.message : "Error desconocido",
        })
      }

      // Pequeña pausa entre envíos para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Enviar notificaciones de pagos vencidos
    for (const payment of payments || []) {
      const loan = (payment as any).loans
      if (!loan) continue

      const clientName = (loan.clients as any)?.name || "Cliente"
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)
      )

      const subject = daysOverdue > 0 
        ? `⚠️ Pago Vencido - ${daysOverdue} ${daysOverdue === 1 ? "día" : "días"}`
        : "📅 Recordatorio de Pago"
      
      const content = daysOverdue > 0
        ? `Hola ${clientName},\n\n` +
          `⚠️ Tienes un pago vencido desde hace ${daysOverdue} ${daysOverdue === 1 ? "día" : "días"}.\n\n` +
          `💰 Monto pendiente: $${payment.amount_due}\n` +
          `📅 Fecha de vencimiento: ${new Date(payment.due_date).toLocaleDateString("es-DO")}\n\n` +
          `Por favor, regulariza tu situación lo antes posible.\n\n` +
          `Esta es una notificación de prueba del sistema.`
        : `Hola ${clientName},\n\n` +
          `📅 Recordatorio: Tienes un pago pendiente.\n\n` +
          `💰 Monto: $${payment.amount_due}\n` +
          `📅 Vence: ${new Date(payment.due_date).toLocaleDateString("es-DO")}\n\n` +
          `Esta es una notificación de prueba del sistema.`

      try {
        const res = await fetch(`${baseUrl}/api/notifications/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loanId: loan.id,
            clientId: loan.client_id,
            phone: TEMP_PHONE,
            subject,
            content,
            type: "whatsapp",
          }),
        })

        if (res.ok) {
          sentCount++
          results.push({
            type: daysOverdue > 0 ? "overdue_payment" : "payment_reminder",
            paymentId: payment.id,
            clientName,
            daysOverdue,
            status: "sent",
          })
        } else {
          const errorData = await res.json()
          results.push({
            type: daysOverdue > 0 ? "overdue_payment" : "payment_reminder",
            paymentId: payment.id,
            clientName,
            status: "failed",
            error: errorData.error || "Error desconocido",
          })
        }
      } catch (err) {
        console.error(`Error enviando notificación para pago ${payment.id}:`, err)
        results.push({
          type: daysOverdue > 0 ? "overdue_payment" : "payment_reminder",
          paymentId: payment.id,
          clientName,
          status: "error",
          error: err instanceof Error ? err.message : "Error desconocido",
        })
      }

      // Pequeña pausa entre envíos
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      ok: true,
      timestamp: today.toISOString(),
      message: `✅ Se enviaron ${sentCount} notificaciones al número ${TEMP_PHONE}`,
      stats: {
        totalLoans: loans?.length || 0,
        totalPayments: payments?.length || 0,
        notificationsSent: sentCount,
        notificationsFailed: results.filter(r => r.status !== "sent").length,
      },
      results,
    })
  } catch (error) {
    console.error("Cron error:", error)
    return NextResponse.json({
      ok: false,
      error: "Error en cron job temporal",
      details: error instanceof Error ? error.message : "Error desconocido",
    }, { status: 500 })
  }
}
