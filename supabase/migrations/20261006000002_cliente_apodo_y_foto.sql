-- =============================================================================
-- Clientes: apodo y fotografía.
--
-- Decisiones de diseño
-- --------------------
-- • El apodo es una columna más de `clientes`, así que hereda TAL CUAL el
--   aislamiento que ya tiene la tabla: las policies de tenant y de permisos no
--   necesitan tocarse.
--
-- • La foto NO se guarda en la fila. Se sube a Supabase Storage y en la tabla
--   queda sólo la ruta. Guardar base64 en `clientes` haría que cada listado
--   arrastrase megas por la red aunque nadie mire las fotos.
--
-- • La ruta es `<admin_id>/<cliente_id>/<archivo>`. Que el tenant sea el PRIMER
--   segmento es lo que permite aplicar el aislamiento en Storage con la misma
--   función `current_tenant_id()` que usa el resto del sistema: un
--   administrador no puede leer, subir ni borrar nada fuera de su carpeta.
--
-- • El bucket es PRIVADO. Las imágenes se sirven con URLs firmadas que caducan,
--   generadas en el servidor tras comprobar la sesión. Un bucket público
--   dejaría las fotos accesibles a cualquiera que adivinara la ruta, lo que
--   rompería el aislamiento por la puerta de atrás.
--
-- No se modifica la jerarquía de usuarios ni ningún permiso existente.
-- =============================================================================

BEGIN;

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS apodo text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS foto_path text;

COMMENT ON COLUMN public.clientes.apodo IS
  'Apodo o alias con el que se conoce al cliente. Opcional. Se usa también en la búsqueda.';
COMMENT ON COLUMN public.clientes.foto_path IS
  'Ruta dentro del bucket clientes-fotos: <admin_id>/<cliente_id>/<archivo>. NULL = sin foto.';

-- Búsqueda parcial por apodo sin recorrer la tabla entera.
-- pg_trgm permite que un ILIKE '%moreno%' use índice; sin él, PostgreSQL
-- tendría que leer todas las filas en cuanto la cartera crezca.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clientes_apodo_trgm
  ON public.clientes USING gin (apodo gin_trgm_ops);

-- Los campos que ya se buscaban se benefician igual del mismo índice.
CREATE INDEX IF NOT EXISTS idx_clientes_nombre_trgm
  ON public.clientes USING gin (nombre gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_apellido_trgm
  ON public.clientes USING gin (apellido gin_trgm_ops);

-- ── 2. Bucket privado para las fotos ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clientes-fotos',
  'clientes-fotos',
  false,                      -- PRIVADO: sólo se sirve con URL firmada
  5242880,                    -- 5 MB por archivo; el cliente ya comprime antes
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 3. Aislamiento en Storage ───────────────────────────────────────────────
-- Mismo criterio que en las tablas: la carpeta raíz es el tenant, y
-- `current_tenant_id()` devuelve NULL para el megaadministrador, así que
-- tampoco él ve las fotos. Es coherente con que no vea los clientes.

DROP POLICY IF EXISTS "clientes_fotos_select" ON storage.objects;
CREATE POLICY "clientes_fotos_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'clientes-fotos'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "clientes_fotos_insert" ON storage.objects;
CREATE POLICY "clientes_fotos_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clientes-fotos'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.has_permission('clientes.editar')
  );

DROP POLICY IF EXISTS "clientes_fotos_update" ON storage.objects;
CREATE POLICY "clientes_fotos_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clientes-fotos'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'clientes-fotos'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.has_permission('clientes.editar')
  );

DROP POLICY IF EXISTS "clientes_fotos_delete" ON storage.objects;
CREATE POLICY "clientes_fotos_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'clientes-fotos'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.has_permission('clientes.editar')
  );

-- ── 4. La ruta de la foto no se puede falsear ───────────────────────────────
-- `foto_path` es una columna normal, así que sin esto un cliente malicioso
-- podría escribir en ella la ruta de la foto de OTRA organización y la URL
-- firmada se generaría igual. El trigger exige que la carpeta raíz coincida
-- con el propietario de la fila.
CREATE OR REPLACE FUNCTION public.validar_foto_path_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.foto_path IS NULL OR NEW.foto_path = '' THEN
    NEW.foto_path := NULL;
    RETURN NEW;
  END IF;

  IF NEW.admin_id IS NULL THEN
    RAISE EXCEPTION 'No se puede asignar una foto a un cliente sin organización';
  END IF;

  IF split_part(NEW.foto_path, '/', 1) <> NEW.admin_id::text THEN
    RAISE EXCEPTION
      'La ruta de la foto no pertenece a la organización del cliente';
  END IF;

  IF split_part(NEW.foto_path, '/', 2) <> NEW.id::text THEN
    RAISE EXCEPTION 'La ruta de la foto no corresponde a este cliente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_foto_path ON public.clientes;
CREATE TRIGGER trg_validar_foto_path
  BEFORE INSERT OR UPDATE OF foto_path ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.validar_foto_path_cliente();

COMMIT;
