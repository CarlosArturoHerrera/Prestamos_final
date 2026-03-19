# Importar schema y datos a Supabase

## Opción 1: Script automático (cuando DATABASE_URL funciona)

```bash
npm run db:verify
```

Si ves error de red (ENOTFOUND, ECONNREFUSED), usa la opción 2.

---

## Opción 2: Manual desde Supabase Dashboard

1. Entra a [Supabase](https://supabase.com) → tu proyecto **kishufirtnpltmjlmmqx**.
2. Menú **SQL Editor** → **New query**.
3. Abre el archivo `supabase/schema.sql` de este proyecto, copia **todo** el contenido.
4. Pégalo en el editor y pulsa **Run** (o Ctrl+Enter).
5. Debe terminar sin errores. Verás tablas: `segments`, `clients`, `loans`, `payments`, `deleted_loans`, `notifications`.
6. Para verificar desde el proyecto: `npm run db:verify`.

---

## Verificar conexión (solo lectura)

Después de importar el schema, en la raíz del proyecto:

```bash
npm run db:verify
```

Debe mostrar: **Conexión Supabase OK** y el número de segmentos.
