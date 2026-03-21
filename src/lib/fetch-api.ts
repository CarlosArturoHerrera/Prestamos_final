/**
 * Fetch a rutas internas con cookies de sesión y errores JSON unificados.
 */

export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok: false; status: number; message: string }
export type ApiResult<T> = ApiOk<T> | ApiErr

export async function fetchApi<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const r = await fetch(url, {
    ...init,
    credentials: "same-origin",
  })

  const text = await r.text()
  let body: Record<string, unknown> = {}
  try {
    if (text) body = JSON.parse(text) as Record<string, unknown>
  } catch {
    body = {}
  }

  if (!r.ok) {
    const errMsg = body.error
    let message: string
    if (typeof errMsg === "string" && errMsg.length > 0) {
      message = errMsg
    } else if (r.status === 401) {
      message = "Sesión expirada o no autorizado. Vuelve a iniciar sesión."
    } else if (r.status === 403) {
      message = "No tienes permiso para esta acción."
    } else {
      message = `Error del servidor (${r.status})`
    }
    return { ok: false, status: r.status, message }
  }

  return { ok: true, data: body as T }
}

/** Si la API devolvió 401, fuerza ir al login (cookies inválidas o sin sesión). */
export function redirectToLoginIfUnauthorized(status: number): void {
  if (status === 401 && typeof window !== "undefined") {
    window.location.assign("/login")
  }
}
