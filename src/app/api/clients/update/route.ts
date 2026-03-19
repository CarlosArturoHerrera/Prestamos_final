import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function PUT(request: Request) {
  try {
    const payload = await request.json().catch(() => null)
    if (!payload) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }

    const { id, name, phone, email, segment, location, notes } = payload
    if (!id || !name || !phone) {
      return NextResponse.json({ error: "ID, nombre y teléfono son requeridos" }, { status: 400 })
    }

    // Get segment ID from segment name
    let segmentId: number | null = null
    if (segment && segment.trim()) {
      const { data: segmentData } = await supabase
        .from("segments")
        .select("id")
        .ilike("name", segment.trim())
        .single()
      
      segmentId = segmentData?.id ?? null
    }

    // Update client
    const { data, error } = await supabase
      .from("clients")
      .update({
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        segment_id: segmentId,
        location: location?.trim() || null,
        notes: notes?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      let errorMessage = error.message
      
      // Handle specific database errors
      if (error.code === "23505") {
        if (error.message.includes("clients_name_key")) {
          errorMessage = "El nombre de cliente ya existe. Por favor, usa otro nombre."
        }
      }
      
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      phone: data.phone,
      segment: segment || "",
      status: "En seguimiento",
      riskLevel: "Estable",
      joinDate: data.created_at,
      lastPayment: data.created_at,
      notes: data.notes || "Sin notas",
      location: data.location || "Sin ubicación",
    })
  } catch (error) {
    console.error("Error updating client:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar cliente" },
      { status: 500 }
    )
  }
}
