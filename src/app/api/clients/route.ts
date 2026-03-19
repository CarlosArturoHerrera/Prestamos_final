import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import type { Client } from "@/lib/types/client"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim()

  const segmentsQuery = supabase.from("segments").select("id, name")
  const segmentsResult = await segmentsQuery

  let segmentIdsBySearch: number[] = []
  if (search) {
    const like = `%${search}%`
    const segFiltered = await supabase.from("segments").select("id").ilike("name", like)
    segmentIdsBySearch = (segFiltered.data ?? []).map((s) => s.id)
  }

  let clientsQuery = supabase.from("clients").select("id, name, phone, email, location, notes, segment_id, created_at").order("created_at", { ascending: false })
  if (search) {
    const like = `%${search}%`
    if (segmentIdsBySearch.length > 0) {
      clientsQuery = clientsQuery.or(
        `name.ilike.${like},segment_id.in.(${segmentIdsBySearch.join(",")})`,
      )
    } else {
      clientsQuery = clientsQuery.ilike("name", like)
    }
  }

  const [{ data: segments }, { data: clients }, { data: loans }, { data: payments }] = await Promise.all([
    segmentsResult,
    clientsQuery,
    supabase.from("loans").select("id, client_id, principal, status"),
    supabase.from("payments").select("loan_id, amount_paid, amount_due, status, paid_at, due_date, created_at"),
  ])

  const segmentMap = new Map((segments ?? []).map((s) => [s.id, s.name]))
  const loansByClient = (loans ?? []).reduce<Record<string, typeof loans>>( (acc, loan) => {
    const list = acc[loan.client_id] ?? []
    list.push(loan)
    acc[loan.client_id] = list
    return acc
  }, {})

  const paymentsByLoan = (payments ?? []).reduce<Record<string, typeof payments>>( (acc, payment) => {
    const list = acc[payment.loan_id] ?? []
    list.push(payment)
    acc[payment.loan_id] = list
    return acc
  }, {})

  const result: Client[] = (clients ?? []).map((client) => {
    const clientLoans = loansByClient[client.id] ?? []

    const statuses = clientLoans.flatMap((loan) => paymentsByLoan[loan.id] ?? []).map((p) => p.status)
    const hasMora = statuses.includes("mora")
    const hasVencido = statuses.includes("vencido")

    const status = hasMora ? "En mora" : hasVencido ? "Pago vencido" : "Al día"
    const riskLevel: Client["riskLevel"] = hasMora ? "Alerta" : hasVencido ? "Vigilancia" : "Estable"

    const lastPaymentDate = clientLoans.reduce<Date | null>((latest, loan) => {
      const loanPayments = paymentsByLoan[loan.id] ?? []
      const loanLatest = loanPayments.reduce<Date | null>((curr, p) => {
        const candidate = p.paid_at ? new Date(p.paid_at) : p.due_date ? new Date(p.due_date) : null
        if (!candidate) return curr
        if (!curr || candidate > curr) return candidate
        return curr
      }, null)
      if (!loanLatest) return latest
      if (!latest || loanLatest > latest) return loanLatest
      return latest
    }, null)

    return {
      id: client.id,
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      segment: segmentMap.get(client.segment_id ?? -1) ?? "",
      status,
      riskLevel,
      joinDate: client.created_at ?? new Date().toISOString(),
      lastPayment: lastPaymentDate?.toISOString() ?? client.created_at ?? new Date().toISOString(),
      notes: client.notes || "Sin notas",
      location: client.location || "Sin ubicación",
    }
  })

  return NextResponse.json(result)
}
