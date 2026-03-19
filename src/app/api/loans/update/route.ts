import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

// Estados que requieren notificación inmediata
const NOTIFICATION_STATUSES = ["aprobado", "cancelado", "completado", "rechazado"]

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  const { id, amount, rate, termMonths, status, startDate, paymentDays } = payload
  if (!id || !amount || !rate || !termMonths || !status || !startDate) {
    return NextResponse.json({ error: "Campos requeridos" }, { status: 400 })
  }

  // Obtener el préstamo actual para comparar
  const { data: currentLoan } = await supabase
    .from("loans")
    .select("client_id, status, clients(name, id)")
    .eq("id", id)
    .single()

  const paymentDaysStr = (paymentDays || ["15", "30"]).join(",")

  const { error } = await supabase
    .from("loans")
    .update({
      principal: Number(amount),
      rate: Number(rate),
      term_months: Number(termMonths),
      status,
      start_date: startDate,
      payment_days: paymentDaysStr,
    })
    .eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Si el estado cambió a uno que requiere notificación, enviarla
  if (
    currentLoan &&
    currentLoan.status !== status &&
    NOTIFICATION_STATUSES.includes(status.toLowerCase())
  ) {
    const clientId = currentLoan.client_id
    const clientName = (currentLoan.clients as any)?.name || "Cliente"

    // Enviar notificación de estado de préstamo
    const statusMessages: Record<string, string> = {
      aprobado: `¡Felicitamos! Tu préstamo ha sido aprobado. Pronto recibirás los detalles del desembolso.`,
      cancelado: `Tu préstamo ha sido cancelado. Si tienes dudas, contáctanos.`,
      completado: `Tu préstamo ha sido completado. Gracias por tu confianza.`,
      rechazado: `Lamentamos informarte que tu solicitud de préstamo ha sido rechazada. Por favor, contáctanos para más información.`,
    }

    try {
      // Obtener el teléfono del cliente (por ahora usaremos placeholder)
      // TODO: Agregar campo de teléfono a la tabla de clientes
      const phone = "+18055551234"

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: id,
          clientId,
          phone,
          subject: `Actualización de estado: ${status}`,
          content: statusMessages[status.toLowerCase()] || `Tu préstamo ha sido actualizado a estado: ${status}`,
          type: "whatsapp",
        }),
      })
    } catch (err) {
      console.error("Error sending status notification:", err)
    }
  }

  return NextResponse.json({ ok: true, id })
}
