import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("segments")
      .select("id, name")
      .order("name", { ascending: true })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error fetching segments:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al obtener segmentos" },
      { status: 500 }
    )
  }
}
