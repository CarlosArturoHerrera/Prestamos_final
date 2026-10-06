#!/usr/bin/env node
/**
 * bootstrap-jerarquia.js — Inicialización segura de la jerarquía de usuarios.
 *
 *   npm run bootstrap
 *
 * Qué hace, en este orden:
 *   1. Crea el MEGAADMINISTRADOR si no existe, con las credenciales que vienen
 *      de VARIABLES DE ENTORNO. Nunca van en el código (§3).
 *   2. Crea el ADMINISTRADOR dueño de la cartera histórica si no existe.
 *   3. Le asigna todos los registros que aún no tienen propietario, llamando a
 *      public.asignar_datos_sin_propietario().
 *
 * Garantías:
 *   • IDEMPOTENTE. Si el megaadministrador ya existe NO se vuelve a crear y
 *     NO se le reescribe la contraseña (§6). MEGAADMIN_PASSWORD es una
 *     credencial de arranque, no una contraseña que se reimponga en cada
 *     despliegue; el megaadministrador la cambia después por el flujo normal.
 *   • La contraseña nunca se imprime, ni se registra, ni se devuelve. Se envía
 *     una sola vez a Supabase Auth, que la almacena hasheada con bcrypt en
 *     auth.users.encrypted_password. En la base de datos de la aplicación no
 *     hay ninguna columna de contraseña (§5, §7).
 *   • NO borra ni modifica ningún dato existente: el paso 3 sólo toca filas
 *     con admin_id IS NULL (§7, §27).
 *
 * Variables de entorno requeridas (.env.local):
 *   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MEGAADMIN_USERNAME
 *   MEGAADMIN_EMAIL
 *   MEGAADMIN_PASSWORD
 * Opcionales (dueño de la cartera histórica):
 *   LEGACY_ADMIN_EMAIL, LEGACY_ADMIN_USERNAME, LEGACY_ADMIN_PASSWORD,
 *   LEGACY_ADMIN_NOMBRE, LEGACY_ADMIN_APELLIDO, LEGACY_ADMIN_TELEFONO,
 *   LEGACY_ADMIN_CEDULA
 */

const path = require("node:path");
const fs = require("node:fs");

// Carga .env.local y, como respaldo, .env — igual que el resto de scripts.
for (const file of [".env.local", ".env"]) {
  const p = path.join(__dirname, "..", file);
  if (fs.existsSync(p)) require("dotenv").config({ path: p, override: false });
}

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MEGAADMIN_USERNAME = process.env.MEGAADMIN_USERNAME;
const MEGAADMIN_EMAIL = process.env.MEGAADMIN_EMAIL;
const MEGAADMIN_PASSWORD = process.env.MEGAADMIN_PASSWORD;

// Datos del administrador que hereda la cartera ya existente.
// Nombre y teléfono no son secretos, así que llevan valor por defecto;
// el email y la contraseña SÍ lo son y deben venir del entorno.
const LEGACY = {
  email: process.env.LEGACY_ADMIN_EMAIL,
  password: process.env.LEGACY_ADMIN_PASSWORD,
  username: process.env.LEGACY_ADMIN_USERNAME || "celias",
  nombre: process.env.LEGACY_ADMIN_NOMBRE || "Carlos Elias",
  apellido: process.env.LEGACY_ADMIN_APELLIDO || "Herrera Montilla",
  telefono: process.env.LEGACY_ADMIN_TELEFONO || "8098602942",
  cedula: process.env.LEGACY_ADMIN_CEDULA || null,
};

const log = {
  step: (m) => console.log(`\n▸ ${m}`),
  ok: (m) => console.log(`  ✓ ${m}`),
  skip: (m) => console.log(`  • ${m}`),
  warn: (m) => console.warn(`  ! ${m}`),
  fail: (m) => console.error(`  ✗ ${m}`),
};

function requireEnv() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!MEGAADMIN_USERNAME) missing.push("MEGAADMIN_USERNAME");
  if (!MEGAADMIN_EMAIL) missing.push("MEGAADMIN_EMAIL");
  if (!MEGAADMIN_PASSWORD) missing.push("MEGAADMIN_PASSWORD");

  if (missing.length) {
    log.fail("Faltan variables de entorno obligatorias:");
    for (const m of missing) console.error(`    - ${m}`);
    console.error(
      "\n  Añádelas a .env.local (ver .env.example). Nunca las escribas en el código.",
    );
    process.exit(1);
  }

  if (MEGAADMIN_PASSWORD.length < 12) {
    log.fail(
      "MEGAADMIN_PASSWORD debe tener al menos 12 caracteres. Elige una más larga.",
    );
    process.exit(1);
  }
}

/** Busca un usuario de auth por email paginando el listado admin. */
async function findAuthUserByEmail(db, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Crea (o localiza) un usuario con su perfil. Nunca reescribe la contraseña de
 * una cuenta que ya existe.
 */
async function ensureUser(db, { email, password, role, profile }) {
  const existing = await findAuthUserByEmail(db, email);

  if (existing) {
    log.skip(`${email} ya existe — no se toca su contraseña`);
    // Se completan únicamente los campos de perfil que estén vacíos.
    const { data: current } = await db
      .from("profiles")
      .select("id, role, username, first_name, last_name, telefono, cedula")
      .eq("id", existing.id)
      .maybeSingle();

    const patch = {};
    if (current && current.role !== role) patch.role = role;
    for (const [col, val] of Object.entries(profile)) {
      if (val != null && current && (current[col] == null || current[col] === "")) {
        patch[col] = val;
      }
    }
    if (Object.keys(patch).length) {
      const { error } = await db.from("profiles").update(patch).eq("id", existing.id);
      if (error) throw new Error(`profiles.update: ${error.message}`);
      log.ok(`perfil completado (${Object.keys(patch).join(", ")})`);
    }
    return { id: existing.id, created: false };
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // handle_new_user() lee esta metadata para crear el perfil con el rol
    // correcto desde el primer instante.
    user_metadata: {
      app_role: role,
      username: profile.username ?? null,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
      telefono: profile.telefono ?? null,
      cedula: profile.cedula ?? null,
      full_name:
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
    },
  });
  if (error) throw new Error(`createUser: ${error.message}`);

  const userId = data.user.id;

  // El trigger ya creó la fila; se reafirma el rol y los datos por si la
  // migración de handle_new_user() no estuviera aplicada todavía.
  const { error: upErr } = await db
    .from("profiles")
    .update({ role, email, is_active: true, ...profile })
    .eq("id", userId);
  if (upErr) throw new Error(`profiles.update: ${upErr.message}`);

  log.ok(`${email} creado con rol ${role}`);
  return { id: userId, created: true };
}

async function main() {
  requireEnv();

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Comprobación previa: las migraciones deben estar aplicadas.
  log.step("Verificando que las migraciones de jerarquía estén aplicadas");
  const { error: probeErr } = await db
    .from("profiles")
    .select("id, admin_id, username")
    .limit(1);
  if (probeErr) {
    log.fail(
      "La tabla profiles no tiene las columnas admin_id/username. Aplica primero las migraciones:",
    );
    console.error("    supabase/migrations/20261005000001_jerarquia_roles_tenancy.sql");
    console.error("    supabase/migrations/20261005000002_rls_aislamiento_tenant.sql");
    console.error("    supabase/migrations/20261005000003_mantenimiento_mensajes_auditoria.sql");
    console.error(`\n  Detalle: ${probeErr.message}`);
    process.exit(1);
  }
  log.ok("esquema de jerarquía presente");

  // ── 1. Megaadministrador ─────────────────────────────────────────────────
  log.step("Megaadministrador");
  const { data: existingSuper } = await db
    .from("profiles")
    .select("id, email")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();

  let megaId;
  if (existingSuper) {
    log.skip(
      `ya hay un megaadministrador (${existingSuper.email || existingSuper.id}) — no se crea otro`,
    );
    megaId = existingSuper.id;
  } else {
    const r = await ensureUser(db, {
      email: MEGAADMIN_EMAIL,
      password: MEGAADMIN_PASSWORD,
      role: "super_admin",
      profile: {
        username: MEGAADMIN_USERNAME,
        first_name: process.env.MEGAADMIN_NOMBRE || "Carlos",
        last_name: process.env.MEGAADMIN_APELLIDO || "Herrera",
      },
    });
    megaId = r.id;
  }

  // ── 2. Administrador dueño de la cartera histórica ───────────────────────
  log.step(`Administrador propietario de los datos existentes`);

  if (!LEGACY.email || !LEGACY.password) {
    log.warn(
      "LEGACY_ADMIN_EMAIL / LEGACY_ADMIN_PASSWORD no están definidos: se omite.",
    );
    log.warn(
      "Los registros actuales quedan con admin_id NULL y SÓLO los ve el megaadministrador.",
    );
    log.warn(
      "Define esas variables y vuelve a ejecutar, o crea el administrador desde el panel y ejecuta de nuevo.",
    );
    console.log("\nListo (parcial).\n");
    return;
  }

  const legacyAdmin = await ensureUser(db, {
    email: LEGACY.email,
    password: LEGACY.password,
    role: "admin",
    profile: {
      username: LEGACY.username,
      first_name: LEGACY.nombre,
      last_name: LEGACY.apellido,
      telefono: LEGACY.telefono,
      cedula: LEGACY.cedula,
    },
  });

  // ── 3. Asignación de la cartera existente ────────────────────────────────
  log.step("Asignando registros sin propietario");
  const { data: asignado, error: asignErr } = await db.rpc(
    "asignar_datos_sin_propietario",
    { p_admin_id: legacyAdmin.id },
  );

  if (asignErr) {
    log.fail(`no se pudo asignar: ${asignErr.message}`);
    process.exit(1);
  }

  const total = Object.values(asignado || {}).reduce((a, b) => a + Number(b), 0);
  if (total === 0) {
    log.skip("no había registros huérfanos: nada que asignar");
  } else {
    for (const [tabla, n] of Object.entries(asignado)) {
      if (Number(n) > 0) log.ok(`${tabla}: ${n} registro(s)`);
    }
  }

  // ── 4. Ficha de mantenimiento inicial ────────────────────────────────────
  log.step("Mantenimiento");
  const { error: mErr } = await db
    .from("admin_maintenance")
    .upsert({ admin_id: legacyAdmin.id }, { onConflict: "admin_id", ignoreDuplicates: true });
  if (mErr) log.warn(`no se pudo crear la ficha de mantenimiento: ${mErr.message}`);
  else log.ok("ficha de mantenimiento lista (configura el día de pago desde el panel)");

  console.log("\n✅ Jerarquía inicializada.\n");
  console.log("   Megaadministrador : inicia sesión con tu usuario o email.");
  console.log(`   Administrador     : ${LEGACY.nombre} ${LEGACY.apellido}`);
  console.log(
    "\n   Cambia ambas contraseñas desde la aplicación y retira las variables",
  );
  console.log("   *_PASSWORD del entorno en cuanto lo hayas hecho.\n");
}

main().catch((err) => {
  // El mensaje de error nunca incluye credenciales: sólo se propagan mensajes
  // de la API de Supabase, que no devuelven la contraseña enviada.
  log.fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
