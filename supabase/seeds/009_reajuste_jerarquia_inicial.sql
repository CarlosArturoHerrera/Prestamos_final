-- =============================================================================
-- Reajuste de la jerarquía a la estructura real de la organización.
--
-- Se ejecuta UNA VEZ, después de aplicar las tres migraciones de jerarquía.
-- Es idempotente: volver a ejecutarlo no cambia nada que ya esté bien.
--
-- Estado de partida (lo que había en la base):
--   carlosarturoherrera23@gmail.com  → admin
--   herreraeliasm@gmail.com          → super_admin
--   carlaherrera103@gmail.com        → admin
--
-- Estado final (la jerarquía real):
--   carlosarturoherrera23@gmail.com  → MEGAADMINISTRADOR (super_admin)
--   herreraeliasm@gmail.com          → ADMINISTRADOR     (dueño de la cartera)
--   carlaherrera103@gmail.com        → SUBUSUARIO        (de herreraeliasm)
--
-- NO se borra ni una fila. No se toca ningún importe, interés, abono ni
-- cálculo financiero: esto sólo reasigna roles y propiedad de los datos.
--
-- El ORDEN importa: primero se promueve al nuevo megaadministrador y sólo
-- después se degrada al anterior, para que la plataforma nunca se quede sin
-- ningún super_admin.
-- =============================================================================

BEGIN;

-- ── 1. Nuevo MEGAADMINISTRADOR ──────────────────────────────────────────────
-- Se asciende primero, para no quedarnos sin megaadministrador en ningún
-- momento de la transacción.
UPDATE public.profiles
   SET role       = 'super_admin',
       admin_id   = NULL,
       first_name = COALESCE(first_name, 'Carlos A.'),
       last_name  = COALESCE(last_name, 'Herrera'),
       username   = COALESCE(username, 'C@rl0sHerrera'),
       updated_at = now()
 WHERE email = 'carlosarturoherrera23@gmail.com';

-- ── 2. ADMINISTRADOR dueño de la cartera ────────────────────────────────────
-- Deja de ser megaadministrador y pasa a ser un tenant con su propia cartera.
UPDATE public.profiles
   SET role       = 'admin',
       admin_id   = NULL,
       first_name = 'Carlos Elias',
       last_name  = 'Herrera Montilla',
       telefono   = COALESCE(telefono, '8098602942'),
       username   = COALESCE(username, 'celias'),
       updated_at = now()
 WHERE email = 'herreraeliasm@gmail.com';

-- ── 3. SUBUSUARIO de ese administrador ──────────────────────────────────────
-- role y admin_id se fijan en la MISMA sentencia: el CHECK
-- profiles_hierarchy_check exige que un sub_user tenga siempre administrador,
-- así que hacerlo en dos pasos fallaría.
UPDATE public.profiles
   SET role       = 'sub_user',
       admin_id   = (SELECT id FROM public.profiles
                      WHERE email = 'herreraeliasm@gmail.com'),
       first_name = COALESCE(first_name, 'Carla'),
       last_name  = COALESCE(last_name, 'Herrera'),
       username   = COALESCE(username, 'carla'),
       updated_at = now()
 WHERE email = 'carlaherrera103@gmail.com';

-- ── 4. Permisos del subusuario ──────────────────────────────────────────────
-- Carla era administradora con acceso total. Se le conceden TODOS los permisos
-- para no recortarle capacidades por sorpresa; el administrador puede
-- ajustarlos después desde /subusuarios.
INSERT INTO public.user_permissions (user_id, permission_code, granted_by)
SELECT c.id, p.code, (SELECT id FROM public.profiles
                       WHERE email = 'carlosarturoherrera23@gmail.com')
  FROM public.profiles c
 CROSS JOIN public.permissions p
 WHERE c.email = 'carlaherrera103@gmail.com'
ON CONFLICT (user_id, permission_code) DO NOTHING;

-- ── 5. Propiedad de la cartera existente ────────────────────────────────────
-- Sólo toca filas con admin_id IS NULL. Nada que ya tenga dueño se reasigna.
SELECT public.asignar_datos_sin_propietario(
         (SELECT id FROM public.profiles WHERE email = 'herreraeliasm@gmail.com')
       ) AS registros_asignados;

-- ── 6. Ficha de mantenimiento del administrador ─────────────────────────────
INSERT INTO public.admin_maintenance (admin_id)
SELECT id FROM public.profiles WHERE email = 'herreraeliasm@gmail.com'
ON CONFLICT (admin_id) DO NOTHING;

COMMIT;

-- ── Verificación ────────────────────────────────────────────────────────────
SELECT
  p.email,
  p.role,
  p.full_name,
  p.username,
  padre.email AS pertenece_a,
  (SELECT count(*)::int FROM public.user_permissions up WHERE up.user_id = p.id)
    AS permisos,
  (SELECT count(*)::int FROM public.clientes c WHERE c.admin_id = p.id)
    AS clientes,
  (SELECT count(*)::int FROM public.prestamos pr WHERE pr.admin_id = p.id)
    AS prestamos
FROM public.profiles p
LEFT JOIN public.profiles padre ON padre.id = p.admin_id
ORDER BY
  CASE p.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
  p.created_at;
