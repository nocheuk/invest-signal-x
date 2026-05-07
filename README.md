# DealSignal

DealSignal is a Vite, React, TypeScript, Tailwind/shadcn SPA for underwriting UK commercial property opportunities.

## Local Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

The app has two data modes:

- Supabase mode when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present.
- Demo fallback mode when those env vars are missing, using static deals and localStorage.

Create a local `.env` from `.env.example`:

```bash
cp .env.example .env
```

## Supabase Setup

Apply migrations in order:

```bash
supabase db push
```

Seed the demo deals with a service-role key from a server-only environment:

```bash
VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed:deals
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or hosted browser environments.

## Migration Notes

`20260507120000_phase1_foundation.sql` creates the MVP data model:

- `profiles`
- `deals`
- `strategies`
- `watchlists`
- `watchlist_items`
- `watchlist_notes`

`20260507150000_phase2a_reliability_schema.sql` adds Phase 2A reliability/data-readiness:

- replaces the incorrect `unique(user_id, is_active)` strategy constraint with a partial unique index allowing only one active strategy per user
- adds `saved_searches`
- adds ingestion-ready tables: `import_sources`, `import_runs`, `raw_imports`, `deal_source_links`, `comparable_transactions`

All public tables have RLS enabled. User-owned tables are restricted to the authenticated owner. Deal/source/comparable reads are public where they support the product browsing experience; write access is intentionally not granted to `anon`.

## Auth UX

Supabase email/password auth is wired for:

- protected app routes
- email confirmation messaging
- resend confirmation
- forgot-password email
- sign-out redirect to `/auth`

Configure Supabase Auth redirect URLs for local and production domains, including:

- `http://localhost:8080/auth`
- your production `/auth` URL

## Tests and Checks

```bash
npm run test
npm run lint
npm run build
```

Current tests cover protected route redirects, Supabase deal loading, strategy save, watchlist add/remove, and notes add/edit.
