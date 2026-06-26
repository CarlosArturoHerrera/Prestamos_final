import { NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getUserAndRole, requireSuperAdmin, badRequest, serverError } from "@/lib/api-auth"

const createAdminSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
  fullName: z.string().min(1, "El nombre es requerido").optional(),
})

// ── GET /api/admin/users ─────────────────────────────────────────────────────
// Returns all admin profiles merged with auth.users metadata (last_sign_in_at).
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  const auth = requireSuperAdmin(session)
  if (auth instanceof NextResponse) return auth

  try {
    const adminClient = createSupabaseAdminClient()

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, email, is_active, created_at, updated_at")
      .order("created_at", { ascending: true })

    if (profilesError) return serverError(profilesError.message)

    // Fetch auth users metadata for last_sign_in_at
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    })

    if (authError) {
      // Non-fatal: return profiles without last_sign_in_at
      return NextResponse.json({ users: profiles })
    }

    const authMap = new Map(
      authData.users.map((u) => [u.id, u.last_sign_in_at ?? null]),
    )

    const users = (profiles ?? []).map((p) => ({
      ...p,
      last_sign_in_at: authMap.get(p.id) ?? null,
    }))

    return NextResponse.json({ users })
  } catch (err) {
    console.error("[admin/users GET]", err)
    return serverError("Error al obtener usuarios")
  }
}

// ── POST /api/admin/users ────────────────────────────────────────────────────
// Creates a new admin user (role = admin, never super_admin).
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const session = await getUserAndRole(supabase)
  const auth = requireSuperAdmin(session)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Cuerpo de solicitud inválido")
  }

  const parsed = createAdminSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Datos inválidos")
  }

  const { email, password, fullName } = parsed.data

  try {
    const adminClient = createSupabaseAdminClient()

    // Create user in Supabase Auth (email already confirmed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : {},
    })

    if (createError) {
      if (createError.message.includes("already registered")) {
        return badRequest("Ya existe un usuario con ese email")
      }
      return serverError(createError.message)
    }

    const userId = newUser.user.id

    // Update profile: the trigger created it with role='admin'; set full_name and email
    await adminClient
      .from("profiles")
      .update({
        role: "admin",
        full_name: fullName ?? null,
        email,
        is_active: true,
      })
      .eq("id", userId)

    return NextResponse.json(
      { message: "Administrador creado correctamente", userId },
      { status: 201 },
    )
  } catch (err) {
    console.error("[admin/users POST]", err)
    return serverError("Error al crear el administrador")
  }
}
