import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseUrlAndAnonKeyForServer } from "@/lib/supabase/env"

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const path = request.nextUrl.pathname

  const supabaseEnv = getSupabaseUrlAndAnonKeyForServer()
  const url = supabaseEnv?.url
  const key = supabaseEnv?.key

  // Supabase not configured — redirect non-login, non-API paths
  if (!url || !key) {
    if (!path.startsWith("/login") && !path.startsWith("/api")) {
      return NextResponse.redirect(new URL("/login?config=1", request.url))
    }
    return response
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Authenticated user visits /login → send to dashboard
  if (path.startsWith("/login")) {
    if (user) {
      const u = request.nextUrl.clone()
      u.pathname = "/"
      return NextResponse.redirect(u)
    }
    return response
  }

  // Public paths that bypass auth checks
  if (path.startsWith("/api") || path === "/403") {
    return response
  }

  // Unauthenticated users → redirect to login
  if (!user) {
    const u = request.nextUrl.clone()
    u.pathname = "/login"
    return NextResponse.redirect(u)
  }

  // ── Role-based access control for /admin/* ────────────────────────────────
  if (path.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle()

    const allowed = profile?.role === "super_admin" && profile?.is_active === true

    if (!allowed) {
      const u = request.nextUrl.clone()
      u.pathname = "/403"
      return NextResponse.redirect(u)
    }
  }

  // ── Block inactive accounts from the dashboard ────────────────────────────
  if (!path.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle()

    if (profile && profile.is_active === false) {
      const u = request.nextUrl.clone()
      u.pathname = "/login"
      u.searchParams.set("error", "inactive")
      return NextResponse.redirect(u)
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
