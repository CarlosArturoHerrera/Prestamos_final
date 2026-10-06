import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { identificadorSchema } from "@/lib/validations/usuarios";

/**
 * POST /api/auth/identificador — resuelve un nombre de usuario a su correo.
 *
 * Por qué existe: Supabase Auth autentica siempre por email, pero la jerarquía
 * define a cada persona por su nombre de usuario (p. ej. `C@rl0sHerrera`).
 * Esta ruta hace de puente: el formulario de login acepta ambos y, cuando
 * recibe un usuario, pide aquí el correo con el que llamar a
 * signInWithPassword.
 *
 * Qué NO hace, deliberadamente:
 *   • No comprueba contraseñas. No es un endpoint de autenticación.
 *   • No revela si una cuenta está activa o deshabilitada: eso lo decide el
 *     login y, después, el layout del dashboard.
 *   • No devuelve rol, organización ni ningún otro dato del perfil.
 *
 * Mitigación de enumeración: respuesta uniforme (mismo cuerpo y mismo código)
 * exista o no el usuario, más un límite por IP. Cuando no hay coincidencia se
 * devuelve el identificador tal cual, de modo que el login falle después en
 * Supabase con el mismo error de "credenciales inválidas" que daría una
 * contraseña incorrecta, sin pistas adicionales.
 */

// Límite en memoria del proceso. Suficiente para frenar el escaneo automático
// desde una IP; no pretende ser un rate limiter distribuido.
const VENTANA_MS = 60_000;
const MAX_INTENTOS = 20;
const intentos = new Map<string, { n: number; hasta: number }>();

function limiteSuperado(ip: string): boolean {
  const ahora = Date.now();
  const actual = intentos.get(ip);

  if (!actual || actual.hasta < ahora) {
    intentos.set(ip, { n: 1, hasta: ahora + VENTANA_MS });

    // Limpieza oportunista para que el Map no crezca sin control.
    if (intentos.size > 5_000) {
      for (const [k, v] of intentos) if (v.hasta < ahora) intentos.delete(k);
    }
    return false;
  }

  actual.n += 1;
  return actual.n > MAX_INTENTOS;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "desconocida";

  if (limiteSuperado(ip)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = identificadorSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      parsed.error.issues[0]?.message ?? "Identificador inválido",
    );
  }

  const { identificador } = parsed.data;

  // Ya es un correo: nada que resolver.
  if (identificador.includes("@") && identificador.includes(".")) {
    return NextResponse.json({ email: identificador });
  }

  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from("profiles")
      .select("email")
      .ilike("username", identificador)
      .maybeSingle();

    // Sin coincidencia → se devuelve lo recibido. El login fallará con el
    // mismo mensaje genérico, sin delatar qué usuarios existen.
    return NextResponse.json({ email: data?.email ?? identificador });
  } catch (err) {
    console.error("[auth/identificador]", err);
    return NextResponse.json({ email: identificador });
  }
}
