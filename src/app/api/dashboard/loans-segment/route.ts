import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { LoanRow } from "@/components/dashboard/segments-tabs"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export async function GET() {
  try {
    // Obtener todos los préstamos
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("id, client_id, principal, rate, term_months, status")
      .order("id", { ascending: true })

    if (loansError) throw loansError

    // Obtener todos los clientes
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")

    if (clientsError) throw clientsError

    // Mapear clientes
    const clientMap = new Map((clients ?? []).map((c: any) => [c.id, c]))

    // Construir respuesta
    const result: LoanRow[] = (loans ?? []).map((loan: any) => {
      const client = clientMap.get(loan.client_id)
      return {
        id: loan.id,
        client: client?.name ?? "",
        amount: formatCurrency(loan.principal),
        rate: `${loan.rate}%`,
        term: `${loan.term_months} meses`,
        status: loan.status || "activo",
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error en /api/dashboard/loans-segment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error cargando préstamos" },
      { status: 500 }
    )
  }
}
