import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Esta función se ejecuta como cron job en Vercel
export async function GET(request: Request) {
  // Verificar token de seguridad
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    // Obtener pagos pendientes que no han sido notificados en las últimas 72 horas
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    const { data: payments, error } = await supabase
      .from("payments")
      .select(`
        id,
        loan_id,
        due_date,
        amount_due,
        loans (
          id,
          client_id,
          principal,
          rate,
          status,
          clients (
            id,
            name,
            phone
          )
        )
      `)
      .eq("status", "pendiente")
      .lt("due_date", new Date().toISOString().split("T")[0])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let sentCount = 0
    const results = []

    for (const payment of payments || []) {
      const loan = (payment as any).loans
      if (!loan) continue

      // No enviar si el préstamo está en estados especiales
      const excludedStatuses = ["en revisión", "aprobado", "cancelado", "completado"]
      if (excludedStatuses.includes(loan.status?.toLowerCase())) {
        continue
      }

      // Verificar si ya se envió notificación en las últimas 72 horas
      const { data: lastNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("loan_id", loan.id)
        .gte("sent_at", seventyTwoHoursAgo)
        .single()

      if (lastNotif) {
        // Ya existe notificación reciente
        continue
      }

      // Obtener teléfono del cliente
      const phone = (loan.clients as any)?.phone

      // Saltar si el cliente no tiene teléfono registrado
      if (!phone) {
        console.log(`Cliente ${loan.clients.name} no tiene teléfono registrado`)
        continue
      }

      // Enviar notificación
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

      try {
        const res = await fetch(`${baseUrl}/api/notifications/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loanId: loan.id,
            clientId: loan.client_id,
            phone,
            subject: "Recordatorio de pago pendiente",
            content: `Estimado/a ${loan.clients.name}, le recordamos que tiene un pago pendiente de $${payment.amount_due}. Por favor realice el pago a tiempo.`,
            type: "whatsapp",
          }),
        })

        if (res.ok) {
          sentCount++
          results.push({ loanId: loan.id, status: "sent" })
        }
      } catch (err) {
        console.error(`Error enviando notificación para préstamo ${loan.id}:`, err)
        results.push({ loanId: loan.id, status: "failed" })
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
