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

## Admin Imports

Phase 2B adds a controlled import foundation without live scraping.

Admins can use `/admin/import` to prepare manual rows or paste CSV data. The browser only validates and previews the rows; it does not hold or use the service-role key. Database writes are done by the local service-role script:

The admin route is guarded by Supabase `app_metadata.role`. Set the user role to `admin` or `owner` for access. Demo fallback mode shows the route for local development without Supabase env vars.

```bash
npm run import:deals -- --file ./imports/deals.csv --source-name "Manual CSV import"
```

Dry-run a file without writing to Supabase:

```bash
npm run import:deals -- --file ./imports/deals.example.csv --source-name "Manual CSV import" --dry-run
```

Required environment variables:

```bash
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Expected CSV headers:

```csv
external_id,source_url,title,location,postcode,region,asset_type,source,guide_price,passing_rent,sqft,net_initial_yield,reversionary_yield,wault,tenant,covenant_strength,main_risk_flag
```

Minimum viable row fields:

- `title`
- `location`
- `guide_price`

Recommended fields for attribution and future Apify/Rightmove compatibility:

- `external_id`
- `source_url`
- `asset_type`
- `source`
- `passing_rent`
- `sqft`
- `tenant`

Import writes:

- one `import_sources` row per source name/type
- one `import_runs` row per CSV execution
- one `raw_imports` row per CSV row
- one `deals` upsert per valid non-duplicate row
- one `deal_source_links` row for attribution

Dedupe rules run in this order:

1. `source_url`
2. `title + postcode`
3. `title + guide_price + location`

Raw row statuses are:

- `pending`
- `processed`
- `failed`
- `skipped_duplicate`

## Rightmove Commercial Import

Phase 2C connects the existing import pipeline to the Apify Rightmove Commercial actor. The Apify token is server-only and must never be exposed through Vite or frontend code.

Required server-side environment variables:

```bash
APIFY_TOKEN=...
RIGHTMOVE_COMMERCIAL_ACTOR_ID=dhrumil/rightmove-commercial-scraper
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Dry-run a Rightmove Commercial search URL. This still runs the Apify actor and fetches dataset items, but it does not write to Supabase:

```bash
npm run import:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/find.html?..." --source-name "Rightmove Commercial Leeds" --dry-run
```

Run a real import:

```bash
npm run import:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/find.html?..." --source-name "Rightmove Commercial Leeds"
```

The Rightmove importer writes through the same tables as CSV imports:

- `import_sources`
- `import_runs`
- `raw_imports`
- `deals`
- `deal_source_links`

Reliable imported fields where present in the Apify dataset:

- external/property id
- Rightmove source URL
- title or display address
- location/address
- postcode/outcode when present or extractable from address
- guide price/rent value
- passing rent when present
- sqft/floor area when present
- property type mapped into DealSignal asset type
- listed/added date when present

Fields that usually still need enrichment or analyst review:

- tenant and covenant strength
- lease length and WAULT
- NIY/reversionary yield when not explicitly listed
- rent review terms
- planning upside
- void risk and exit sensitivity
- comparable evidence and AI summaries

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

`20260507170000_phase2b_import_foundation.sql` adds import execution fields and constraints:

- `raw_imports.row_number`
- `raw_imports.deal_id`
- `raw_imports.validation_errors`
- `raw_imports.dedupe_key`
- import status checks
- source URL and row-number indexes for dedupe and traceability

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
