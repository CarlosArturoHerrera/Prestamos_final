import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  const { clientId, amount, rate, termMonths, status, startDate, paymentDays } = payload
  if (!clientId || !amount || !rate || !termMonths || !status || !startDate) {
    return NextResponse.json({ error: "Campos requeridos" }, { status: 400 })
  }

  const id = payload.id ?? `PR-${Date.now()}`
  const paymentDaysStr = (paymentDays || ["15", "30"]).join(",")

  const { error } = await supabase.from("loans").insert({
    id,
    client_id: clientId,
    principal: Number(amount),
    rate: Number(rate),
    term_months: Number(termMonths),
    status,
    start_date: startDate,
    payment_days: paymentDaysStr,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id })
}
