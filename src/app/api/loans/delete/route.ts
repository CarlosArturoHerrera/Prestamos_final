import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: Request) {
  const { loanId } = await request.json().catch(() => ({ loanId: null }))
  if (!loanId) {
    return NextResponse.json({ error: "loanId requerido" }, { status: 400 })
  }

  // Insert into deleted_loans; if already exists, no-op
  const { error } = await supabase
    .from("deleted_loans")
    .upsert({ loan_id: loanId }, { onConflict: "loan_id" })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
