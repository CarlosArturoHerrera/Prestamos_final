import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { ClientRow } from "@/components/dashboard/segments-tabs"

export async function GET() {
  try {
    // Obtener segmentos
    const { data: segments } = await supabase.from("segments").select("id, name")

    // Obtener clientes
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name, segment_id")
      .order("name", { ascending: true })

    if (clientsError) throw clientsError

    // Obtener todos los préstamos y pagos
    const { data: loans } = await supabase.from("loans").select("id, client_id, principal, status")
    const { data: payments } = await supabase.from("payments").select("loan_id, status, amount_due, amount_paid")

    // Mapear datos
    const segmentMap = new Map((segments ?? []).map((s: any) => [s.id, s.name]))
    const loansByClient = (loans ?? []).reduce<Record<string, any[]>>((acc, loan) => {
      acc[loan.client_id] = acc[loan.client_id] || []
      acc[loan.client_id].push(loan)
      return acc
    }, {})

    const paymentsByLoan = (payments ?? []).reduce<Record<string, any[]>>((acc, payment) => {
      acc[payment.loan_id] = acc[payment.loan_id] || []
      acc[payment.loan_id].push(payment)
      return acc
    }, {})

    // Construir respuesta
    const result: ClientRow[] = (clients ?? []).map((client: any) => {
      const clientLoans = loansByClient[client.id] || []
      const balance = clientLoans.reduce((sum, loan) => sum + (loan.principal ?? 0), 0)

      const loanPayments = clientLoans.flatMap((loan) => paymentsByLoan[loan.id] || [])
      const hasDefaulted = loanPayments.some((p) => p.status === "mora" || p.status === "vencido")

      return {
        name: client.name,
        segment: segmentMap.get(client.segment_id) ?? "",
        status: hasDefaulted ? "Atraso" : "Al día",
        balance: `$${balance.toLocaleString("es-DO")}`,
        risk: hasDefaulted ? "Alerta" : "Estable",
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error en /api/dashboard/clients-segment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error cargando clientes" },
      { status: 500 }
    )
  }
}
