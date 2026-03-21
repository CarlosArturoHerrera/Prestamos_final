# Mejoras de robustez (frontend + sesión)

## Qué se hizo

### 1. `src/lib/env-public.ts`
- Función **`isSupabaseConfiguredOnClient()`** para saber si las variables `NEXT_PUBLIC_*` existen en el bundle del navegador (Vercel debe tenerlas en build).

### 2. `src/lib/fetch-api.ts`
- **`fetchApi<T>()`**: llama a la API con **`credentials: "same-origin"`** (cookies de sesión Supabase).
- Unifica errores: lee el JSON `{ error: "..." }` de las rutas.
- **`redirectToLoginIfUnauthorized(status)`**: si la API devuelve **401**, redirige a `/login` (sesión caducada o sin cookie).

### 3. Dashboard (`src/app/(dashboard)/page.tsx`)
- Comprueba env **antes** de llamar a la API (evita “cargando” infinito sin mensaje).
- **Skeleton** mientras carga (mejor UX que solo texto).
- Si falla: **Alert** + botones **Reintentar** e **Ir al inicio de sesión**.
- Mensajes de error más claros.

### 4. Login (`src/app/login/page.tsx`)
- Usa `isSupabaseConfiguredOnClient()` desde el helper central.
- Si el cliente lanza error por env, el toast explica que falta configurar el hosting.

### 5. `AppShell` (logout)
- Si no hay env de Supabase, **no intenta** crear cliente (evita crash).
- `try/finally`: siempre navega a `/login` tras cerrar sesión.

### 6. Páginas que consumen API
Todas pasan a usar **`fetchApi`** + **`redirectToLoginIfUnauthorized`** donde aplica:
- Empresas, Representantes, Clientes (+ edición), Préstamos, Detalle préstamo, Notificaciones, Reportes, Detalle cliente.

### 7. `src/lib/supabase/browser.ts`
- Reexporta **`isSupabaseConfiguredOnClient`** desde `env-public` para imports cómodos.

### 8. `src/lib/fetch-api.ts` (detalle)
- `fetch` usa `...init` y luego `credentials: "same-origin"` para no pisar headers personalizados.

---

## Qué debes seguir haciendo tú en producción

1. Variables en **Vercel**: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Tablas correctas: **`empresas`** y **`representantes`** (no solo `companies` / `representatives`).
3. Fila en **`profiles`** para tu usuario de Auth si hace falta.
