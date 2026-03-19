import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim()

  let loansQuery = supabase
    .from("loans")
    .select("id, client_id, principal, rate, term_months, status, start_date, created_at, clients ( name )")
    .order("id", { ascending: true })

  if (search) {
    loansQuery = loansQuery.ilike("clients.name", `%${search}%`)
  }

  const [loansRes, deletedRes] = await Promise.all([
    loansQuery,
    supabase.from("deleted_loans").select("loan_id"),
  ])

  if (loansRes.error) {
    return NextResponse.json({ error: loansRes.error.message }, { status: 400 })
  }
  if (deletedRes.error) {
    return NextResponse.json({ error: deletedRes.error.message }, { status: 400 })
  }

  const deletedIds = new Set((deletedRes.data ?? []).map((d) => d.loan_id))

  const rows = (loansRes.data ?? []).filter((row) => !deletedIds.has(row.id)).map((row) => ({
    id: row.id,
    client_id: row.client_id,
    client_name: (row.clients as { name?: string } | null)?.name ?? "",
    principal: Number(row.principal ?? 0),
    interest_rate: Number(row.rate ?? 0),
    term_months: Number(row.term_months ?? 0),
    status: row.status ?? "",
    start_date: row.start_date ?? null,
    created_at: row.created_at ?? null,
  }))

  return NextResponse.json(rows)
}
