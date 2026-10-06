#!/usr/bin/env node
/**
 * deploy-migraciones.js — Aplica las migraciones de jerarquía al proyecto
 * Supabase remoto y verifica el resultado.
 *
 *   npm run deploy:jerarquia              # aplica
 *   npm run deploy:jerarquia -- --dry-run # sólo comprueba conexión y estado
 *   npm run deploy:jerarquia -- --verify  # sólo verifica lo ya aplicado
 *
 * Admite DOS vías de acceso, usa la que encuentre:
 *
 *   A) DATABASE_URL           → conexión directa con el driver `pg`.
 *      Supabase Dashboard → Settings → Database → Connection string (URI).
 *
 *   B) SUPABASE_ACCESS_TOKEN  → Management API, el mismo canal que usa el
 *      editor SQL del dashboard. Token en
 *      https://supabase.com/dashboard/account/tokens
 *      Requiere además SUPABASE_URL (de ahí se saca el project ref).
 *
 * Seguridad y reversibilidad:
 *   • Cada archivo .sql ya trae su propio BEGIN/COMMIT: o entra entero o no
 *     entra nada. Un fallo a mitad no deja el esquema a medias.
 *   • Las tres migraciones son idempotentes: volver a ejecutarlas no rompe
 *     nada ni duplica objetos.
 *   • NO se ejecuta el backfill de datos. Asignar la cartera existente es un
 *     paso aparte y explícito (`npm run bootstrap`).
 *   • Ningún secreto se imprime.
 */

const fs = require("node:fs");
const path = require("node:path");

for (const file of [".env.local", ".env"]) {
  const p = path.join(__dirname, "..", file);
  if (fs.existsSync(p)) require("dotenv").config({ path: p, override: false });
}

const MIGRACIONES = [
  "20261005000001_jerarquia_roles_tenancy.sql",
  "20261005000002_rls_aislamiento_tenant.sql",
  "20261005000003_mantenimiento_mensajes_auditoria.sql",
];

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SOLO_VERIFICAR = args.includes("--verify");

const log = {
  step: (m) => console.log(`\n▸ ${m}`),
  ok: (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
  skip: (m) => console.log(`  • ${m}`),
  warn: (m) => console.warn(`  \x1b[33m!\x1b[0m ${m}`),
  fail: (m) => console.error(`  \x1b[31m✗\x1b[0m ${m}`),
};

// ── Capa de ejecución: dos implementaciones con la misma interfaz ───────────

function crearEjecutorDirecto(databaseUrl) {
  const { Client } = require("pg");
  // Supabase exige TLS; su certificado es de una CA intermedia que Node no
  // trae, así que se desactiva la verificación de cadena. El transporte sigue
  // cifrado — es lo mismo que hace `supabase db push`.
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 300_000,
  });

  return {
    nombre: "conexión directa (pg)",
    async conectar() {
      await client.connect();
    },
    async ejecutar(sql) {
      const res = await client.query(sql);
      return Array.isArray(res) ? res[res.length - 1]?.rows : res.rows;
    },
    async cerrar() {
      await client.end().catch(() => {});
    },
  };
}

function crearEjecutorManagementApi(accessToken, projectRef) {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  return {
    nombre: `Management API (proyecto ${projectRef})`,
    async conectar() {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "select 1 as ok;" }),
      });
      if (!res.ok) {
        const cuerpo = await res.text();
        throw new Error(
          `no se pudo conectar (HTTP ${res.status}). ` +
            (res.status === 401
              ? "El SUPABASE_ACCESS_TOKEN no es válido o ha caducado."
              : cuerpo.slice(0, 300)),
        );
      }
    },
    async ejecutar(sql) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      const texto = await res.text();
      if (!res.ok) {
        let detalle = texto.slice(0, 1000);
        try {
          const j = JSON.parse(texto);
          detalle = j.message ?? j.error ?? detalle;
        } catch {
          /* respuesta no JSON */
        }
        throw new Error(detalle);
      }
      try {
        return JSON.parse(texto);
      } catch {
        return [];
      }
    },
    async cerrar() {},
  };
}

function elegirEjecutor() {
  const databaseUrl = process.env.DATABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    (supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

  if (databaseUrl) return crearEjecutorDirecto(databaseUrl);
  if (accessToken && projectRef)
    return crearEjecutorManagementApi(accessToken, projectRef);

  log.fail("No hay ninguna credencial con permiso para ejecutar DDL.");
  console.error(`
  La clave service_role NO sirve: va por PostgREST, que no ejecuta DDL.
  Añade a .env.local UNA de estas dos (cualquiera vale):

  A) Contraseña de la base de datos
     Supabase Dashboard → Settings → Database → Connection string → URI
        DATABASE_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres

  B) Token de acceso personal  (recomendado: no hay que resetear nada)
     https://supabase.com/dashboard/account/tokens → Generate new token
        SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxx
${projectRef ? `\n  Project ref detectado: ${projectRef}` : ""}
`);
  process.exit(1);
}

// ── Verificación posterior ─────────────────────────────────────────────────

const SQL_VERIFICACION = `
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('current_tenant_id','has_permission','session_context',
                         'asignar_datos_sin_propietario','stamp_tenant_from_session'))::int
    as funciones,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and column_name = 'admin_id'
       and table_name in ('empresas','representantes','clientes','prestamos',
                          'notificaciones','gestion_cobranza'))::int
    as columnas_tenant,
  (select count(*) from pg_policies
     where schemaname = 'public' and policyname like '%_tenant_isolation')::int
    as policies_aislamiento,
  (select count(*) from pg_policies
     where schemaname = 'public' and policyname like '%_perm_%')::int
    as policies_permisos,
  -- to_regclass evita que la consulta reviente ANTES de aplicar las
  -- migraciones, cuando la tabla todavía no existe.
  (case when to_regclass('public.permissions') is null then 0
        else (select count(*) from public.permissions) end)::int as permisos_catalogo,
  (select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('permissions','user_permissions','admin_maintenance',
                          'admin_maintenance_payments','admin_messages','audit_logs'))::int
    as tablas_nuevas;
`;

// Sólo tiene sentido tras aplicar las migraciones: la columna admin_id no
// existe antes. El llamador lo comprueba con `columnas_tenant`.
const SQL_HUERFANOS = `
select
  (select count(*) from public.empresas          where admin_id is null)::int as empresas,
  (select count(*) from public.representantes    where admin_id is null)::int as representantes,
  (select count(*) from public.clientes          where admin_id is null)::int as clientes,
  (select count(*) from public.prestamos         where admin_id is null)::int as prestamos,
  (select count(*) from public.notificaciones    where admin_id is null)::int as notificaciones,
  (select count(*) from public.gestion_cobranza  where admin_id is null)::int as gestion_cobranza;
`;

const ESPERADO = {
  funciones: 5,
  columnas_tenant: 6,
  policies_aislamiento: 9,
  policies_permisos: 36,
  tablas_nuevas: 6,
};

function primeraFila(resultado) {
  if (!resultado) return null;
  if (Array.isArray(resultado)) {
    const ultimo = resultado[resultado.length - 1];
    if (Array.isArray(ultimo)) return ultimo[0] ?? null;
    if (ultimo && Array.isArray(ultimo.rows)) return ultimo.rows[0] ?? null;
    return ultimo ?? null;
  }
  return resultado;
}

async function verificar(ejecutor) {
  log.step("Verificando el esquema");
  const v = primeraFila(await ejecutor.ejecutar(SQL_VERIFICACION));
  if (!v) {
    log.fail("la consulta de verificación no devolvió resultados");
    return false;
  }

  let todoBien = true;
  for (const [clave, esperado] of Object.entries(ESPERADO)) {
    const obtenido = Number(v[clave]);
    const bien = obtenido >= esperado;
    if (!bien) todoBien = false;
    (bien ? log.ok : log.fail)(
      `${clave.padEnd(22)} ${obtenido}${bien ? "" : ` (se esperaban ${esperado})`}`,
    );
  }
  log.ok(`permisos_catalogo      ${v.permisos_catalogo}`);

  if (Number(v.columnas_tenant) < ESPERADO.columnas_tenant) {
    console.log(
      "\n  (las columnas de tenant aun no existen: aplica las migraciones)\n",
    );
    return todoBien;
  }

  log.step("Registros sin propietario (admin_id IS NULL)");
  const h = primeraFila(await ejecutor.ejecutar(SQL_HUERFANOS));
  const total = Object.values(h || {}).reduce((a, b) => a + Number(b), 0);
  if (total === 0) {
    log.ok("ninguno: toda la cartera tiene administrador asignado");
  } else {
    for (const [tabla, n] of Object.entries(h)) {
      if (Number(n) > 0) log.warn(`${tabla.padEnd(22)} ${n}`);
    }
    console.log(`
  Estos registros EXISTEN y están intactos, pero ahora mismo sólo los ve el
  megaadministrador. Asígnalos a su administrador propietario con:

      npm run bootstrap
`);
  }

  return todoBien;
}

// ── Principal ──────────────────────────────────────────────────────────────

async function main() {
  const ejecutor = elegirEjecutor();

  log.step(`Conectando — ${ejecutor.nombre}`);
  try {
    await ejecutor.conectar();
    log.ok("conexión establecida");
  } catch (err) {
    log.fail(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    if (SOLO_VERIFICAR) {
      const ok = await verificar(ejecutor);
      console.log(
        ok ? "\n✅ Esquema correcto.\n" : "\n❌ Faltan objetos por aplicar.\n",
      );
      process.exit(ok ? 0 : 1);
    }

    const dir = path.join(__dirname, "..", "supabase", "migrations");

    if (DRY_RUN) {
      log.step("Dry run — no se ejecuta nada");
      for (const nombre of MIGRACIONES) {
        const ruta = path.join(dir, nombre);
        if (!fs.existsSync(ruta)) {
          log.fail(`${nombre} — NO ENCONTRADA`);
          process.exit(1);
        }
        const lineas = fs.readFileSync(ruta, "utf8").split("\n").length;
        log.ok(`${nombre} (${lineas} líneas)`);
      }
      await verificar(ejecutor);
      console.log("\nTodo listo. Ejecuta sin --dry-run para aplicar.\n");
      return;
    }

    log.step("Aplicando migraciones");
    for (const nombre of MIGRACIONES) {
      const ruta = path.join(dir, nombre);
      const sql = fs.readFileSync(ruta, "utf8");
      process.stdout.write(`  … ${nombre}`);
      try {
        await ejecutor.ejecutar(sql);
        process.stdout.write(`\r  \x1b[32m✓\x1b[0m ${nombre}\n`);
      } catch (err) {
        process.stdout.write(`\r  \x1b[31m✗\x1b[0m ${nombre}\n`);
        log.fail(err instanceof Error ? err.message : String(err));
        console.error(`
  La migración abortó por completo (cada archivo va en su propia transacción),
  así que el esquema sigue como estaba. Corrige el error y vuelve a ejecutar.
`);
        process.exit(1);
      }
    }

    const ok = await verificar(ejecutor);

    console.log(`
${ok ? "✅ Migraciones aplicadas y verificadas." : "⚠️  Aplicadas, pero la verificación encontró huecos."}

   Siguiente paso:
     1. npm run bootstrap        — crea el megaadministrador y asigna la cartera
     2. Ejecuta en el SQL Editor supabase/tests/aislamiento_multitenant.sql
`);
    process.exit(ok ? 0 : 1);
  } finally {
    await ejecutor.cerrar();
  }
}

main().catch((err) => {
  log.fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
