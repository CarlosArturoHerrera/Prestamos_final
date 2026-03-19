# Sistema de Autenticación con Supabase + NextAuth

## Instalación completada ✅

El sistema de autenticación ha sido configurado exitosamente.

## Archivos creados/modificados:

1. **Configuración de NextAuth**: [src/lib/auth.ts](src/lib/auth.ts)
2. **API Route de NextAuth**: [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/[...nextauth]/route.ts)
3. **Session Provider**: [src/components/providers/session-provider.tsx](src/components/providers/session-provider.tsx)
4. **Middleware de protección**: [src/middleware.ts](src/middleware.ts)
5. **Página de login**: [src/app/login/page.tsx](src/app/login/page.tsx)
6. **Layout principal actualizado**: [src/app/layout.tsx](src/app/layout.tsx)
7. **Dashboard con logout**: [src/components/dashboard/dashboard-tab.tsx](src/components/dashboard/dashboard-tab.tsx)

## Configuración requerida:

### 1. Variables de entorno
Copia el archivo `.env.local.example` a `.env.local` y configura:

```bash
# Supabase
SUPABASE_URL=tu-url-de-supabase
SUPABASE_ANON_KEY=tu-anon-key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=genera-una-clave-secreta
```

Para generar `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 2. Configurar Supabase Auth
En tu proyecto de Supabase, asegúrate de tener habilitado:
- Email/Password authentication
- Usuarios creados en tu base de datos

### 3. Crear usuarios de prueba
Puedes crear usuarios directamente en Supabase Dashboard o mediante SQL:

```sql
-- No necesitas crear usuarios manualmente, usa la página de registro de Supabase
-- O crea un endpoint de registro en tu aplicación
```

## Funcionalidades implementadas:

✅ Login con email/password usando Supabase
✅ Protección de rutas mediante middleware
✅ Sesión persistente con JWT
✅ Botón de cerrar sesión en el dashboard
✅ Redirección automática a /login si no está autenticado
✅ Página de login responsive con validación

## Uso:

1. Configura las variables de entorno
2. Inicia el servidor: `bun dev`
3. Ve a http://localhost:3000 (te redirigirá a /login)
4. Ingresa credenciales de un usuario de Supabase
5. Una vez autenticado, accede al dashboard

## Rutas protegidas:
Todas las rutas están protegidas excepto:
- `/login` - Página de inicio de sesión
- `/api/auth/*` - Endpoints de NextAuth

## Próximos pasos (opcional):
- Agregar registro de usuarios
- Recuperación de contraseña
- Autenticación con OAuth (Google, GitHub, etc.)
- Roles y permisos
