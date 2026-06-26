-- ============================================================
-- Seed 008: Create the initial Super Admin
-- ============================================================
-- INSTRUCTIONS:
--   1. Run migrations 001–005 first.
--   2. Go to Supabase Dashboard → Authentication → Users → "Add user".
--      Use the email and password you want for the Super Admin.
--      Note the UUID generated (e.g. "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx").
--   3. Replace <SUPER_ADMIN_UUID> below with that UUID.
--   4. Replace <SUPER_ADMIN_EMAIL> with the email used.
--   5. Run this script in the SQL Editor.
--
-- Alternatively, create the user via the Supabase Admin API:
--   curl -X POST 'https://<project>.supabase.co/auth/v1/admin/users' \
--     -H "apikey: <service_role_key>" \
--     -H "Authorization: Bearer <service_role_key>" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"admin@example.com","password":"ChangeMe123!","email_confirm":true}'
--
-- Then run the UPDATE below.
-- ============================================================

-- OPTION A: If you know the UUID of the already-created user, run this:
/*
UPDATE public.profiles
  SET role = 'super_admin',
      is_active = true,
      full_name = 'Super Admin',
      email = '<SUPER_ADMIN_EMAIL>',
      updated_at = now()
  WHERE id = '<SUPER_ADMIN_UUID>'::uuid;
*/

-- OPTION B: Set the FIRST created user as super_admin (useful for fresh setups)
/*
UPDATE public.profiles
  SET role = 'super_admin',
      is_active = true,
      updated_at = now()
  WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1);
*/

-- OPTION C: Set by email (if the email column is populated)
/*
UPDATE public.profiles
  SET role = 'super_admin',
      is_active = true,
      updated_at = now()
  WHERE email = 'your-super-admin@example.com';
*/

-- ── How to change the Super Admin email later ────────────────
-- 1. In Supabase Dashboard → Authentication → Users, find and update the email.
-- 2. Also update the cached email in profiles:
--    UPDATE public.profiles SET email = 'new-email@example.com' WHERE role = 'super_admin';
-- ── Verify the result ─────────────────────────────────────────
-- SELECT id, email, role, is_active FROM public.profiles WHERE role = 'super_admin';
