# Supabase — Migraciones, RLS y Administración

## Estructura de carpetas

```
supabase/
├── migrations/          # Archivos SQL numerados — ejecutar en orden
├── policies/            # Copias de referencia de las políticas RLS
├── functions/           # Copias de referencia de funciones PostgreSQL
├── seeds/               # Seeds iniciales de datos
└── README.md            # Este archivo
```

---

## 1. Cómo ejecutar las migraciones

### Usando Supabase CLI (recomendado)

```bash
# Instalar CLI si no está instalado
npm install -g supabase

# Autenticar
supabase login

# Vincular proyecto
supabase link --project-ref <project-ref>

# Aplicar todas las migraciones pendientes
supabase db push
```

### Usando el SQL Editor de Supabase

1. Ve a **Supabase Dashboard → SQL Editor**
2. Abre cada archivo en `migrations/` en orden numérico
3. Ejecuta uno por uno verificando que no haya errores

**Orden correcto:**
```
20260625000001_update_profiles_roles.sql
20260625000002_rls_helper_functions.sql
20260625000003_rls_profiles.sql
20260625000004_rls_business_tables.sql
20260625000005_indexes.sql
```

---

## 2. Variables de entorno requeridas

Agrega a `.env.local`:

```env
# Ya existentes
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# NUEVO — requerido para gestión de usuarios (super admin)
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

> La `service_role_key` se encuentra en: **Supabase Dashboard → Settings → API → service_role secret**

---

## 3. Cómo crear el Super Admin

El Super Admin **no puede crearse desde la interfaz**. Solo puede asignarse directamente en la base de datos.

### Pasos:

1. **Crear el usuario en Supabase Auth:**
   - Ve a **Authentication → Users → Add user**
   - Ingresa el email y contraseña
   - Copia el UUID generado

2. **Asignar el rol `super_admin`** — abre `seeds/008_seed_super_admin.sql` y ejecuta la opción que aplique:

   ```sql
   -- Por UUID (más preciso)
   UPDATE public.profiles
     SET role = 'super_admin', is_active = true
     WHERE id = '<UUID>'::uuid;

   -- Por email
   UPDATE public.profiles
     SET role = 'super_admin', is_active = true
     WHERE email = 'tu-email@ejemplo.com';
   ```

3. **Verificar:**
   ```sql
   SELECT id, email, role, is_active FROM public.profiles WHERE role = 'super_admin';
   ```

### Cambiar el email del Super Admin:

```sql
-- 1. Actualizar en Supabase Auth (Dashboard → Users → editar)
-- 2. Sincronizar en profiles:
UPDATE public.profiles
  SET email = 'nuevo-email@ejemplo.com'
  WHERE role = 'super_admin';
```

---

## 4. Sistema de roles

| Rol | Descripción |
|-----|-------------|
| `super_admin` | Único. Puede crear/editar/eliminar admins. Acceso total. |
| `admin` | Puede usar el sistema completo pero NO gestionar usuarios. |

Los roles se almacenan en `public.profiles.role`.

---

## 5. Cómo funciona el RLS

Las políticas RLS usan funciones `SECURITY DEFINER` para evitar recursión:

- `public.is_super_admin()` → `true` si el usuario actual es super_admin activo
- `public.is_admin()` → `true` si el usuario actual es admin o super_admin activo
- `public.get_current_role()` → retorna el texto del rol actual

**profiles:**
- SELECT: solo su propio perfil, o todos si es super_admin
- INSERT: solo su propio perfil (fallback del trigger)
- UPDATE/DELETE: solo super_admin

**Tablas de negocio (clientes, préstamos, etc.):**
- ALL: cualquier usuario activo con rol admin/super_admin

---

## 6. Cómo agregar futuras migraciones

1. Crea un nuevo archivo en `migrations/` con timestamp:
   ```
   YYYYMMDDHHMMSS_descripcion.sql
   ```

2. Envuelve el contenido en una transacción:
   ```sql
   BEGIN;
   -- tu SQL aquí
   COMMIT;
   ```

3. Ejecuta con Supabase CLI o desde el SQL Editor.

---

## 7. Rollback

Supabase CLI no tiene rollback automático. Para revertir:

1. Identifica qué cambió en la migración
2. Escribe el SQL inverso manualmente
3. Ejecútalo en el SQL Editor

**Ejemplo de rollback para migration 001:**
```sql
-- Revertir roles a ADMIN/OPERADOR
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
UPDATE public.profiles SET role = 'ADMIN' WHERE role IN ('super_admin', 'admin');
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'OPERADOR';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('ADMIN', 'OPERADOR'));
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_active;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
```

---

## 8. Despliegue en producción

1. Aplicar migraciones **antes** de desplegar el nuevo código
2. Asegúrate de que `SUPABASE_SERVICE_ROLE_KEY` esté configurado en las variables de entorno de producción
3. Verifica que el Super Admin exista antes de lanzar
4. Prueba el flujo: login → acceso a `/admin/users` → crear admin de prueba

---

## 9. Funciones SQL disponibles

| Función | Retorna | Descripción |
|---------|---------|-------------|
| `public.get_current_role()` | `text` | Rol del usuario actual |
| `public.is_super_admin()` | `boolean` | El usuario actual es super_admin activo |
| `public.is_admin()` | `boolean` | El usuario actual es admin activo (cualquier rol) |
| `public.disable_admin(uuid)` | `boolean` | Desactiva una cuenta (solo super_admin) |
| `public.enable_admin(uuid)` | `boolean` | Reactiva una cuenta (solo super_admin) |
