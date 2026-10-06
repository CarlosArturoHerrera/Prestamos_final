# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js on port 3000)
npm run build        # Production build
npm run lint         # Biome check (linter)
npm run format       # Biome format with auto-fix
npm run db:seed      # Verify and seed the database (scripts/verify-and-seed.js)
npm run bootstrap    # Create megaadmin + assign existing data to its owner admin
```

No test suite is configured — there are no test files in this project.

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in real values. Required variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXTAUTH_URL` + `NEXTAUTH_SECRET` | NextAuth session config |
| `DATABASE_URL` | Direct PostgreSQL connection (scripts only) |
| `TWILIO_ACCOUNT_SID` + `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` | Twilio WhatsApp (uses API Key, NOT AuthToken) |
| `TWILIO_WHATSAPP_FROM` | Sender number, e.g. `whatsapp:+18099421913` |
| `TWILIO_MORA_TEMPLATE_SID` | Twilio Content Template SID (must start with `HX`) |
| `GROQ_API_KEY` | AI chat assistant (Llama 3.3 via Groq) |
| `CRON_SECRET` | Bearer token for cron job routes |

## Architecture Overview

**Stack:** Next.js 16 (App Router) + Supabase (PostgreSQL + Auth) + NextAuth + Tailwind v4 + Biome

### Route Groups

All authenticated pages live under `src/app/(dashboard)/` and are wrapped by `AppShell` ([src/components/app/app-shell.tsx](src/components/app/app-shell.tsx)), which renders the collapsible desktop sidebar, mobile drawer, and bottom nav bar. Navigation items are defined in the `nav` array inside that file.

The modules are: **Dashboard** `/`, **Empresas**, **Representantes**, **Clientes**, **Préstamos**, **Notificaciones**, **Reportes**.

### Auth Pattern

Two auth systems coexist:
- **Supabase Auth** — primary session management. Server routes use `createSupabaseServerClient()` from `src/lib/supabase/server.ts` (cookie-based SSR client). Browser components use `createSupabaseBrowserClient()` from `src/lib/supabase/browser.ts`.
- **NextAuth** — legacy/parallel session layer used for JWT tokens via `authOptions` in `src/lib/auth.ts`.

Every API route must call `getUserAndRole(supabase)` from `src/lib/api-auth.ts` to authenticate. It returns a `Session` with `role`, `adminId` (tenant) and `permissions`. Helper functions `unauthorized()`, `forbidden()`, `notFound()`, `badRequest()`, `serverError()` return typed `NextResponse` objects; guards are `requireSuperAdmin()`, `requireTenant()` and `requirePermission(session, code)`.

### Multi-tenant hierarchy

Roles are `super_admin` (MEGAADMINISTRADOR — manages *accounts*, **has no access to business data**) | `admin` (ADMINISTRADOR, owns a tenant) | `sub_user` (SUBUSUARIO, belongs to an admin, granular permissions). See [JERARQUIA_USUARIOS.md](JERARQUIA_USUARIOS.md) for the full model and deployment steps.

Tenant isolation lives in the **database**, not in route code:

- `admin_id` columns on `empresas`, `representantes`, `clientes`, `prestamos`, `notificaciones`, `gestion_cobranza`. Child tables (`abonos`, `reganches`, `intereses_atrasados`) derive ownership from their `prestamos` row via `EXISTS`.
- BEFORE INSERT triggers stamp `admin_id` from the session — an `admin_id` sent by the client is overwritten.
- `RESTRICTIVE` RLS policies AND a tenant filter on top of the existing permissive ones, so every existing query is scoped automatically and IDOR is blocked at the DB layer.

**Do not add a manual `admin_id` filter in new routes** — it is redundant with RLS and risks diverging.

Every business-data route must start with:

```ts
const bloqueo = soloOrganizacion(session);
if (bloqueo) return bloqueo;
```

or `requireTenant(session)` when the handler needs the session afterwards. The super_admin has `adminId === null` and gets a 403: it administers accounts, never clientes/prestamos/abonos. `current_tenant_id()` returns NULL for it, so RLS already returns zero rows — the guard only turns that into a clear error.

Permissions: catalog in `public.permissions` + `src/lib/permissions.ts`, assignments in `user_permissions`, evaluated by `public.has_permission()` in SQL and `hasPermission(session, code)` in TS.

### Loan Business Logic

All financial calculations are in `src/lib/finance.ts` using `decimal.js` for precision. Loan lifecycle logic (interest accrual, capitalization, payment scheduling) is in `src/lib/prestamo-logic.ts`:

- Loans have states: `ACTIVO` → `MORA` → `SALDADO`
- Interest accrues when `fecha_proximo_vencimiento` is reached. After +3 calendar days unpaid, interest is **capitalized** (added to `capital_pendiente`) and the loan enters `MORA`.
- `sincronizarInteresesYCapitalizacionAuto()` runs automatically on loan detail load and on the list view for candidate loans (those in MORA or with past-due dates).
- Abonos (payments) are recorded in the `abonos` table; interest overdue tracking is in `intereses_atrasados`; reganche (capital increases) in `reganches`.

### API Routes Pattern

Client-side fetches use `fetchApi<T>()` from `src/lib/fetch-api.ts`, which handles credentials, JSON parsing, and standardized error messages. Validation uses Zod schemas from `src/lib/validations/schemas.ts`.

Active routes are under `/api/prestamos/`, `/api/clientes/`, `/api/empresas/`, `/api/representantes/`, `/api/notificaciones/`, `/api/reportes/`.

The older `/api/loans/`, `/api/clients/`, `/api/notifications/`, `/api/segments/`, `/api/dashboard/*-segment/`, `/api/cron/*` routes and `src/actions/dashboard.ts` are **dead code**: they query `clients`, `loans`, `payments`, `segments` and `notifications`, which `20250321000000_microfinanzas.sql` dropped. They can only return errors.

### Notifications

WhatsApp via Twilio (`src/lib/twilio-whatsapp.ts`) — uses API Key credentials (not Auth Token). Phone numbers are normalized to E.164 format with NANP heuristics for Dominican Republic numbers (809/829/849). Cron routes under `/api/cron/` require `Authorization: Bearer <CRON_SECRET>`.

### AI Chat Assistant

`/api/chat/route.ts` streams responses using Vercel AI SDK + Groq (Llama 3.3-70b). The system prompt in `src/lib/mega-system-prompt.ts` describes the full DB schema. `src/lib/ai-helpers.ts` builds real-time context from Supabase for each request.

### Theming

Global CSS variables are in `src/app/globals.css` — `:root` for light mode, `.dark` for dark mode. Mapped to Tailwind via `@theme inline`. Theme toggle is managed by `next-themes`. Sidebar colors use dedicated `--sidebar-*` variables separate from main theme colors.

### UI Components

`src/components/ui/` contains shadcn/ui components (Radix UI primitives + Tailwind). Dashboard-specific components are in `src/components/dashboard/`. Use `cn()` from `src/lib/utils.ts` for conditional class merging.
