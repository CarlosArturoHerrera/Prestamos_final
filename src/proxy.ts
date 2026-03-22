import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseUrlAndAnonKeyForServer } from "@/lib/supabase/env"

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const path = request.nextUrl.pathname

  const supabaseEnv = getSupabaseUrlAndAnonKeyForServer()
  const url = supabaseEnv?.url
  const key = supabaseEnv?.key

  // Sin variables en el host (ej. Vercel), antes se dejaba pasar a "/" sin sesión → panel "cargando" y sin login.
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
        response = NextResponse.next({
          request,
        })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (path.startsWith("/login")) {
    if (user) {
      const u = request.nextUrl.clone()
      u.pathname = "/"
      return NextResponse.redirect(u)
    }
    return response
  }

  if (path.startsWith("/api")) {
    return response
  }

  if (!user) {
    const u = request.nextUrl.clone()
    u.pathname = "/login"
    return NextResponse.redirect(u)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
