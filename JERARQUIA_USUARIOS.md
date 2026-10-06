# Jerarquía de usuarios y multi-tenant

> **Estado: Fases A y B completadas** (pendiente de aplicar las migraciones).
> A = base de datos, autorización y aislamiento de backend.
> B = interfaz: paneles, permisos, islas de aviso y login por usuario.

## 1. Modelo

```text
MEGAADMINISTRADOR  (profiles.role = 'super_admin')   — acceso global
        │
        ├── ADMINISTRADOR  (role = 'admin')          — un tenant aislado
        │        ├── SUBUSUARIO (role = 'sub_user', admin_id = administrador)
        │        └── SUBUSUARIO
        │
        └── ADMINISTRADOR
                 └── SUBUSUARIO
```

Los dos primeros roles **ya existían** en el proyecto y se reutilizan tal cual.
El único rol nuevo es `sub_user`.

### Clave de tenant

| Rol | `profiles.admin_id` | `current_tenant_id()` |
|---|---|---|
| `super_admin` | `NULL` | `NULL` — **sin acceso a datos operativos** |
| `admin` | `NULL` | su propio `id` |
| `sub_user` | id de su administrador | ese id, **o `NULL` si el administrador está deshabilitado** |

Esa última fila es lo que implementa §11: deshabilitar un administrador corta
el acceso de todos sus subusuarios al instante, sin tocar ni un dato.

## 2. Cómo se consigue el aislamiento

El enfoque **no** es añadir un `WHERE admin_id = …` en cada una de las ~50
rutas API. Son dos mecanismos en la base de datos:

**a) Triggers de estampado.** Al insertar, el propietario lo pone el servidor a
partir de la sesión. Un `admin_id` enviado desde el frontend se ignora y se
sobrescribe (§15, §17, §29).

**b) Policies RLS `RESTRICTIVE`.** En Postgres las policies permisivas se
combinan con `OR`, pero cada restrictiva se aplica con `AND`. Añadiéndolas
encima de las que ya existían, el filtro de tenant se vuelve inevitable sin
reescribir ni una policy previa. Es el mismo patrón que ya usaba
`20260819000001_prestamos_delete_super_admin.sql`.

La consecuencia buscada es que **la protección IDOR (§18) es automática**: un
`GET /api/clientes/123` de otra organización no encuentra la fila, `.single()`
falla y la ruta responde 404 sin filtrar nada.

### El megaadministrador NO accede a los datos operativos

Ésta es la regla que más define la arquitectura, y conviene entender por qué
funciona sin depender de que nadie se acuerde de filtrar:

```text
MEGAADMINISTRADOR → administra CUENTAS (alta, baja, mantenimiento, mensajes)
                  → NUNCA clientes, préstamos, abonos ni registros
```

`current_tenant_id()` devuelve `NULL` para él, porque no pertenece a ninguna
organización. Las policies de negocio comparan `admin_id = current_tenant_id()`
y `algo = NULL` da `NULL`, nunca `TRUE`. **No le cuadra ninguna fila.** No hay
excepción `is_super_admin() OR …` en ninguna tabla de negocio — la migración
`20261005000004` la eliminó precisamente para esto.

Capas, de dentro afuera:

| Capa | Qué hace |
|---|---|
| RLS | No le devuelve ninguna fila de negocio. Es la medida real. |
| `has_permission()` | Le concede sólo `administradores.*`. Jamás un permiso de negocio, aunque se intente insertar en `user_permissions`. |
| `soloOrganizacion()` | Las ~40 rutas de datos le responden **403** con motivo `megaadmin_sin_acceso_a_datos`, en vez de un resultado vacío confuso. |
| `proxy.ts` | Le redirige de cualquier pantalla de cartera a `/admin/users`. |
| Menú | Sólo ve "Administradores". |

Las tres últimas son comodidad y claridad. La que protege de verdad es la
primera: aunque se olvidara un guard o alguien forzara una URL, la base de
datos no devuelve nada.

### Herencia en tablas hijas

`abonos`, `reganches` e `intereses_atrasados` **no llevan columna `admin_id`**:
su propietario es por definición el del préstamo, y se deriva con un `EXISTS`.
Así no se denormalizan datos financieros y es imposible que se desincronicen.

## 3. Orden de despliegue

### Paso 1 — Migraciones

**Opción automática** (recomendada). Añade a `.env.local` una credencial con
permiso DDL — la `service_role` key **no sirve**, porque va por PostgREST y
PostgREST no ejecuta DDL:

```env
# A) Token personal — https://supabase.com/dashboard/account/tokens
SUPABASE_ACCESS_TOKEN=sbp_...
# B) O la cadena de conexión — Dashboard → Settings → Database → URI
DATABASE_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres
```

Después:

```bash
npm run deploy:jerarquia -- --dry-run   # comprueba conexión y estado
npm run deploy:jerarquia                # aplica y verifica
npm run deploy:jerarquia -- --verify    # sólo verifica
```

**Opción manual**: Supabase Dashboard → SQL Editor, **en este orden**:

```text
supabase/migrations/20261005000001_jerarquia_roles_tenancy.sql
supabase/migrations/20261005000002_rls_aislamiento_tenant.sql
supabase/migrations/20261005000003_mantenimiento_mensajes_auditoria.sql
supabase/migrations/20261005000004_megaadmin_sin_acceso_a_datos.sql
```

Las cuatro son aditivas e idempotentes: no borran filas ni columnas, y cada una
va en su propia transacción, así que un fallo no deja el esquema a medias.

> La `…0004` corrige el modelo de acceso del megaadministrador: las tres
> primeras le daban acceso global a los datos, lo cual era incorrecto.

> **Requisito previo:** deben estar aplicadas las migraciones `20260625000001`
> … `20260626000002` (roles `super_admin`/`admin`). Si `profiles.role` todavía
> contiene `'ADMIN'` o `'OPERADOR'`, aplica primero `20260625000001`.

Tras el paso 1 todos los registros existentes tienen `admin_id = NULL` y
**sólo los ve el megaadministrador**. No se ha perdido nada; falta asignarlos.

### Paso 2 — Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```env
MEGAADMIN_USERNAME=C@rl0sHerrera
MEGAADMIN_EMAIL=...
MEGAADMIN_PASSWORD=...        # mínimo 12 caracteres

LEGACY_ADMIN_EMAIL=...        # Carlos Elias Herrera Montilla
LEGACY_ADMIN_PASSWORD=...
LEGACY_ADMIN_USERNAME=celias
LEGACY_ADMIN_NOMBRE=Carlos Elias
LEGACY_ADMIN_APELLIDO=Herrera Montilla
LEGACY_ADMIN_TELEFONO=8098602942
```

`.gitignore` ignora todo `.env*` y deja pasar únicamente `.env.example`, que no
contiene ningún valor real.

### Paso 3 — Bootstrap

```bash
npm run bootstrap
```

1. Crea el megaadministrador **si no existe**. Si ya existe, no lo duplica y
   **no le reescribe la contraseña** (§6).
2. Crea el administrador *Carlos Elias Herrera Montilla*.
3. Le asigna toda la cartera existente llamando a
   `asignar_datos_sin_propietario()`, que sólo toca filas con `admin_id IS NULL`.

Las contraseñas van a Supabase Auth, que las guarda con bcrypt en
`auth.users.encrypted_password`. **En las tablas de la aplicación no hay
ninguna columna de contraseña**, y el script no las imprime nunca.

Cuando ambas cuentas hayan cambiado su contraseña desde la aplicación, retira
las variables `*_PASSWORD` del entorno.

### Paso 4 — Verificar el aislamiento

```text
supabase/tests/aislamiento_multitenant.sql   -> 32 comprobaciones
supabase/tests/megaadmin_sin_acceso.sql      -> 22 comprobaciones
```

Pégalos en el SQL Editor. El primero crea dos administradores con cartera y
tres subusuarios y verifica el aislamiento entre ellos; el segundo se ejecuta
contra las **cuentas reales** y comprueba que el megaadministrador no ve nada
de negocio. **Ambos terminan en `ROLLBACK`**: no dejan ningún dato de prueba.

## 4. Superficie nueva de API

| Ruta | Método | Quién |
|---|---|---|
| `/api/subusuarios` | GET, POST | admin (los suyos) · super_admin (con `?adminId=`) |
| `/api/subusuarios/[id]` | GET, PATCH, DELETE | igual, con comprobación de pertenencia |
| `/api/permisos` | GET | admin y super_admin — catálogo para el formulario |
| `/api/auth/identificador` | POST | público — resuelve usuario → correo para el login |
| `/api/profile` | GET | devuelve además `adminId` y `permissions` |
| `/api/admin/users` | GET, POST | administradores + mantenimiento + nº de subusuarios |
| `/api/admin/users/[id]` | GET, PATCH, DELETE | ficha, deshabilitar/reactivar, reset de contraseña |
| `/api/admin/users/[id]/mantenimiento` | GET, PATCH, POST | configurar mantenimiento y registrar pagos |
| `/api/admin/mensajes` | GET, POST | mensajes personalizados |
| `/api/admin/mensajes/[id]` | PATCH, DELETE | editar o borrar un mensaje |
| `/api/mi-cuenta/avisos` | GET, PATCH | islas de aviso del administrador; marcar leído |

`PATCH /api/subusuarios/[id]` con `{"action":"reset_password"}` envía el correo
de restablecimiento reutilizando el mecanismo que ya existía
(`generateLink` + Resend). Nunca se envía una contraseña (§24).

## 5. Permisos

El catálogo vive en `public.permissions` (base de datos) y en
`src/lib/permissions.ts` (tipos y UI). Se evalúan igual en ambas capas:

- `super_admin` y `admin` → todos los permisos de su ámbito.
- `sub_user` → sólo los concedidos en `user_permissions`.

Se aplican **en la base de datos** mediante `has_permission()` y policies
restrictivas por operación, no sólo ocultando botones.

## 6. Qué NO se tocó

- `src/lib/finance.ts` y `src/lib/prestamo-logic.ts`: sin un solo cambio.
- Cálculos de interés, capital, saldos, cuotas, períodos, abonos, comisiones,
  reganches y capitalización: intactos.
- Ninguna fila ni columna existente fue eliminada.

La arquitectura nueva sólo decide **quién entra, qué puede hacer y qué filas
ve**. Cómo se calcula el dinero no cambió.

## 7. Privilegio que cambió de manos: borrar préstamos

La migración `20260819000001` reservaba el `DELETE` de préstamos al
`super_admin`. Con el modelo corregido el megaadministrador ya no ve los
préstamos, así que esa regla habría dejado el borrado **imposible para todo el
mundo**.

El privilegio pasa al **administrador titular** de la organización — sigue
fuera del alcance de un subusuario cualquiera, que es lo que la regla original
protegía. Se aplica en tres sitios coherentes entre sí:

| Dónde | Qué |
|---|---|
| `prestamos_delete_titular_only` | Policy `RESTRICTIVE` con `is_admin_only()` |
| `soloTitular()` | Guard de `DELETE /api/prestamos/[id]` |
| `useIsAdminTitular()` | Muestra el botón sólo al titular |

## 8. Cambios de constraint que conviene conocer

Dos restricciones `UNIQUE` globales pasaron a ser **únicas por organización**,
porque con multi-tenant dos administradores distintos pueden legítimamente
tener una empresa con el mismo nombre o un cliente con la misma cédula:

| Antes | Ahora |
|---|---|
| `empresas.nombre UNIQUE` | `UNIQUE (admin_id, nombre)` |
| `clientes.cedula UNIQUE` | `UNIQUE (admin_id, cedula)` |

Es una **relajación**, no una pérdida: todo lo que cumplía la regla anterior
cumple la nueva. Ningún dato se borra ni se modifica.

## 9. Interfaz (Fase B)

| Pantalla | Quién | Qué hace |
|---|---|---|
| `/admin/users` | megaadmin | **Su única pantalla.** Lista de administradores con estado de mantenimiento y nº de subusuarios. Crear (nombre, apellido, cédula, teléfono, correo, usuario, contraseña), editar, deshabilitar, reactivar, eliminar, restablecer contraseña, **configurar mantenimiento y registrar pagos**, **enviar mensajes**. No muestra clientes, préstamos, pagos ni saldos de nadie |
| `/subusuarios` | administrador | Alta, edición, permisos, activar/desactivar, eliminar y reset de contraseña de sus subusuarios |
| Isla de avisos | administrador | Mantenimiento pendiente o vencido y mensajes sin leer, al iniciar sesión |
| Login | todos | Acepta **usuario o correo** |
| Menú lateral | subusuario | Sólo los módulos para los que tiene permiso |
| Menú lateral | megaadmin | Sólo "Administradores"; cualquier otra ruta le redirige allí |

El editor de permisos agrupa por módulo, con marcado por grupo y contadores.

### Pendiente

- Visor de auditoría para el megaadministrador (la tabla `audit_logs` ya se
  rellena; falta la pantalla que la lea).
- Gestión de subusuarios de *otro* administrador desde el panel del
  megaadministrador. La API ya lo soporta (`/api/subusuarios?adminId=…`); falta
  el acceso en la interfaz.
- Ocultar botones de acción concretos dentro de cada módulo según el permiso
  fino (hoy el menú filtra por módulo; la API y RLS ya bloquean lo demás, pero
  el subusuario ve el botón y recibe un 403 al pulsarlo).

## 10. Observación sobre código muerto detectado

Durante el análisis apareció que estas rutas consultan tablas que la migración
`20250321000000_microfinanzas.sql` **eliminó** (`clients`, `loans`, `payments`,
`segments`, `notifications`):

```text
/api/clients, /api/clients/create, /api/clients/update
/api/loans, /api/loans/create, /api/loans/update, /api/loans/delete
/api/notifications, /api/notifications/send
/api/segments
/api/dashboard/clients-segment, loans-segment, notifications-segment
/api/cron/*  (las cuatro)
src/actions/dashboard.ts
```

`CLAUDE.md` las describía como activas; no lo están desde esa migración. No se
han tocado —quedan fuera del alcance de este trabajo— pero conviene decidir si
se eliminan o se reescriben, porque hoy sólo pueden devolver errores.

El webhook `/api/twilio/status` **sí** estaba vivo y usaba el cliente anónimo
sobre `notificaciones`; se pasó a `service_role`, porque el aislamiento revoca
el acceso de `anon` a las tablas de negocio.
