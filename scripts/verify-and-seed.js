/**
 * Verifica la conexión a Supabase y opcionalmente importa schema + datos.
 * Uso: npm run db:verify   (carga .env.local desde la raíz del proyecto)
 */
const path = require("path");
const fs = require("fs");

// Cargar .env.local desde la raíz del proyecto
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

async function verifySupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env.local");
    process.exit(1);
  }
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.from("segments").select("id, name").limit(5);
  if (error) {
    if (error.message.includes("schema cache") || error.message.includes("does not exist")) {
      console.error("❌ Conexión OK pero la tabla 'segments' no existe.");
      console.log("\n→ Importa el schema: Supabase Dashboard → SQL Editor → pega y ejecuta el contenido de supabase/schema.sql");
      return false;
    }
    console.error("❌ Error conectando con Supabase (cliente):", error.message);
    return false;
  }
  console.log("✅ Conexión Supabase OK. Segmentos:", data?.length ?? 0, "registro(s).");
  return true;
}

async function runSchemaWithPg() {
  if (!DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL no definida. No se puede ejecutar el schema desde este script.");
    console.log("\nPara importar schema y datos manualmente:");
    console.log("  1. Abre Supabase Dashboard → SQL Editor");
    console.log("  2. Pega y ejecuta el contenido de: supabase/schema.sql");
    return false;
  }
  const { Client } = require("pg");
  const schemaPath = path.join(__dirname, "..", "supabase", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error("❌ No se encontró supabase/schema.sql");
    return false;
  }
  const sql = fs.readFileSync(schemaPath, "utf8");
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    console.log("✅ Conexión PostgreSQL (DATABASE_URL) OK.");
    await client.query(sql);
    console.log("✅ Schema y datos importados correctamente.");
    return true;
  } catch (err) {
    console.error("❌ Error ejecutando schema:", err.message);
    if (err.message.includes("ENOTFOUND") || err.message.includes("ECONNREFUSED")) {
      console.log("\n→ Importa manualmente: Supabase Dashboard → SQL Editor → pega y ejecuta supabase/schema.sql");
    }
    return false;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("Verificando conexión y datos...\n");
  // Primero importar schema/datos si hay DATABASE_URL
  await runSchemaWithPg();
  // Luego verificar que el cliente Supabase puede leer
  const clientOk = await verifySupabaseClient();
  if (!clientOk) process.exit(1);
  console.log("\nListo.");
}

main();
