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

The Apify importer is still available, but DealSignal also includes an experimental custom Rightmove Commercial scraper that does not require Apify. It fetches a Rightmove Commercial search page server-side with conservative request settings, parses listing cards from the returned HTML, and reuses the same validation, dedupe, scoring and import runner.

Required server-side environment variables:

```bash
APIFY_TOKEN=...
RIGHTMOVE_COMMERCIAL_ACTOR_ID=dhrumil/rightmove-commercial-scraper
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Dry-run a Rightmove Commercial search URL. This still runs the Apify actor and fetches dataset items, but it does not write to Supabase:

```bash
npm run import:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/find.html?..." --source-name "Rightmove Commercial" --dry-run
```

Run a real import:

```bash
npm run import:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/find.html?..." --source-name "Rightmove Commercial"
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

### Custom Rightmove Commercial Scraper

Dry-run the custom scraper without writing to Supabase:

```bash
npm run scrape:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html" --source-name "Rightmove Commercial" --dry-run
```

Run a live import after checking the dry-run output:

```bash
npm run scrape:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html" --source-name "Rightmove Commercial"
```

Live mode requires the same server-side Supabase variables as other service-role imports:

```bash
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

The custom scraper imports these fields when they are visible in the HTML:

- external/property id
- listing URL
- title
- location/address and extractable postcode
- guide price
- passing rent/rent if visible
- sqft/floor area
- property type mapped into DealSignal asset type
- description/snippet
- first image URL
- listed date if visible

If Rightmove blocks the request or changes the markup, the script exits cleanly with:

```text
Rightmove page could not be parsed. The custom scraper may need updating.
```

The custom scraper is intentionally separate from `npm run import:rightmove` and should be treated as experimental until it has been tested across several Rightmove location/search URL formats.

### Dashboard Location Search Import

The dashboard location filter first searches deals already in Supabase. When a signed-in user enters a location with no or very few local matches, DealSignal shows a live-search CTA that calls the server-side `/api/location-search` route. The route verifies the Supabase access token with `auth.getUser(jwt)`, then runs fresh scans against Rightmove Commercial and Acuitus.

Live location imports are available to authenticated users, with basic abuse protection:

- max 5 live location searches per user per hour
- max 20 live location searches per user per day
- repeated searches are allowed as manual refreshes while still counting against hourly/daily limits
- minimum location query length of 3 characters

The generated URL format is:

```text
https://www.rightmove.co.uk/commercial-property-for-sale/{Location}.html
```

For example, `Bournemouth` becomes:

```text
https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html
```

This supports locations that Rightmove accepts in that URL format. If the generated URL cannot be parsed, use the manual scraper command with a copied Rightmove search URL:

```bash
npm run scrape:rightmove -- --url "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html" --source-name "Rightmove Commercial" --dry-run
```

For Acuitus, live location search scrapes the main listings page first:

```text
https://www.acuitus.co.uk/find-a-property/
```

Then it filters parsed Acuitus rows by the user's location query across title, location, postcode and region before passing matching rows to the import pipeline.

Duplicate source URLs are treated as refreshed existing deals. The importer writes a new `raw_imports` payload, updates `deal_source_links.raw_import_id`, and counts the row as existing/refreshed instead of creating a duplicate deal.

Vercel/server-side environment variables required for live dashboard imports:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Manual import tools under `/admin/import` remain admin-only.

### Scheduled National England Scan

DealSignal can run a conservative daily national scan via Vercel Cron. It does not scrape a single giant England page. Instead, each run takes the next small batch from a larger England city and commercial-town queue and scans those locations with the custom Rightmove Commercial scraper. Acuitus, Eddisons and Allsop are included once per scheduled run from their main sale/listing pages.

The queue lives in `scripts/lib/englandLocationQueue.mjs` and includes:

- all official English cities
- major commercial towns such as Bournemouth, Poole, Reading, Warrington, Watford and Stockport
- selected regional/county search areas such as Dorset, Hampshire, Surrey, Kent, Essex and Sussex

The default batch size is 16 Rightmove locations per run. The scheduler stores the next queue index in `national_scan_runs.metadata.next_index`, so each run continues from the previous position and wraps around after the final queued location. Duplicate source URLs refresh existing deals through the import pipeline instead of creating duplicate deals.

Each scan run stores coverage diagnostics in `national_scan_runs.metadata`:

- total configured locations
- locations scanned in the batch
- next queue index
- estimated full-cycle duration
- scan cycle progress

On Vercel Hobby the cron is daily, so it can take multiple days to rotate through every city/town in the queue. With the current 160-location queue and a 16-location batch, one full cycle takes about 10 days. A future Pro plan can scan more often and/or use a larger safe batch size.

Rightmove, Eddisons and Allsop pagination are supported conservatively when the first search page exposes pagination links. The scrapers follow a small number of discovered search-result pages, keep requests serial, and deduplicate repeated source URLs before writing through the import pipeline.

Vercel Cron is configured in `vercel.json`:

```json
{
  "path": "/api/cron/national-scan",
  "schedule": "0 5 * * *"
}
```

Vercel cron schedules use UTC. During UK summer time (BST), `0 5 * * *` runs at 6am UK time. During GMT/winter, use `0 6 * * *` if you want to keep the scan at exactly 6am UK time manually.

Required Vercel/server-side environment variables:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
APP_BASE_URL=https://your-production-app.example.com
```

`CRON_SECRET` protects `/api/cron/national-scan`. Call the endpoint with:

```text
Authorization: Bearer <CRON_SECRET>
```

Run a local dry-run batch without writing to Supabase:

```bash
npm run scan:national -- --dry-run
```

Audit Rightmove URL coverage for every configured England location without writing to Supabase:

```bash
npm run validate:rightmove-locations
```

The validator logs each generated Rightmove URL, HTTP status, final redirected URL, whether property cards were detected, parser status and listings found. It finishes with totals for valid, redirected, empty, parser-failure and unsupported locations.

Benchmark national scan throughput without writing to Supabase:

```bash
npm run benchmark:national-scan
```

The benchmark tests batch sizes 4, 8, 12 and 16 by default and reports runtime, memory, reachable rows, dry-run imported deals and estimated full-cycle duration. The recommendation uses the current Vercel cron `maxDuration` of 60 seconds with a 60% safety budget.

Run a local live batch:

```bash
npm run scan:national
```

Change the batch size locally:

```bash
npm run scan:national -- --batch-size 3 --dry-run
```

Scan run records are stored in `national_scan_runs` with:

- scan type
- location scanned
- source scanned
- inserted
- existing/refreshed
- failed/skipped counts
- started/finished timestamps
- raw result metadata

### Saved Alerts V1

Users can save dashboard investment criteria as alerts from the dashboard using **Create Alert**. Saved alerts are stored in `saved_alerts` and include:

- location query
- minimum yield
- maximum guide price
- asset type
- minimum DealSignal score
- enabled/disabled state

The daily national scan evaluates active saved alerts after the import batch completes. Matching uses only real imported deal rows refreshed or inserted by the scan window:

- location query must match deal title, location or region when provided
- `min_yield` compares against `net_initial_yield`
- `max_price` compares against `guide_price`; missing prices do not match a max-price alert
- `asset_type` must match unless set to `All`
- `min_score` compares against the current DealSignal score

Duplicate alert emails are suppressed by `alert_matches` with a unique `(alert_id, deal_id)` constraint. Once a deal has matched a saved alert, the same deal is not emailed again for that alert on later refreshes.

Alert runs are tracked in:

- `alert_runs`: daily/batch run status, matched deal count, email count, metadata and errors
- `alert_matches`: alert/deal matches, match reasons, payload snapshot and email status

Email delivery is provider-backed. V1 supports Resend from server-side code without exposing keys to the frontend:

```bash
RESEND_API_KEY=...
ALERT_EMAIL_FROM="DealSignal <alerts@yourdomain.com>"
APP_BASE_URL=https://your-production-app.example.com
```

If `RESEND_API_KEY` is not configured, DealSignal still records alert matches and payloads, but `email_status` is stored as `provider_not_configured` and no email is sent. Apply the `saved_alerts` migration before deploying this feature.

## Custom HTML Scraper Template

Custom scrapers are server-side only and reuse the same import pipeline as CSV and Rightmove imports. They fetch a listing page, parse listing cards with a selector config, normalize rows, validate, dedupe, write `raw_imports`, upsert `deals`, and create `deal_source_links`.

Run a dry-run without writing to Supabase:

```bash
npm run scrape:site -- --url "https://example-agent-site.com/commercial" --source-name "Example Agent" --selector-config ./scrapers/example-agent.json --dry-run
```

Run a live import:

```bash
npm run scrape:site -- --url "https://example-agent-site.com/commercial" --source-name "Example Agent" --selector-config ./scrapers/example-agent.json
```

Acuitus example:

```bash
npm run scrape:site -- --url "https://www.acuitus.co.uk/find-a-property/" --source-name "Acuitus" --selector-config ./scrapers/acuitus.json --dry-run
```

Eddisons sale-listing scraper:

```bash
npm run scrape:eddisons -- --dry-run
```

The Eddisons scraper targets `https://www.eddisons.com/property-search?purchase-type-id=for-sale&limit=24`, parses server-rendered `.property-card` listings, skips rent-only and POA rows, and imports only rows with a concrete sale guide price. It maps title/address, guide price, passing rent when visible, floor area, asset type, image URL and source URL into the shared import pipeline. Increase or reduce the page cap with `--max-pages=2`.

Run a live Eddisons import:

```bash
npm run scrape:eddisons
```

Allsop commercial auction scraper:

```bash
npm run scrape:allsop -- --dry-run
```

The Allsop scraper uses Allsop's public property-search JSON endpoint server-side, filters to commercial sale/acquisition lots, skips POA and non-commercial rows, and maps title, overview URL, address, guide price, passing rent/income where visible, yield where visible, floor area, asset type, description, image URL and auction/reference data into the shared import pipeline. Increase or reduce the page cap with `--max-pages=2`.

Run a live Allsop import:

```bash
npm run scrape:allsop
```

Limitations: Allsop lot numbers are imported when the source payload exposes them. Some current search rows expose investment references instead of auction lot numbers; those are still deduped by source URL/reference and need legal-pack verification before underwriting.

Live imports require:

```bash
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Create a new scraper by adding a selector config JSON file under `scrapers/`. The config supports:

```json
{
  "selectors": {
    "listingCardSelector": ".listing-card",
    "titleSelector": ".listing-title",
    "urlSelector": { "selector": "a.listing-link", "attribute": "href" },
    "locationSelector": ".listing-location",
    "priceSelector": ".listing-price",
    "rentSelector": ".listing-rent",
    "sizeSelector": ".listing-size",
    "propertyTypeSelector": ".listing-type",
    "descriptionSelector": ".listing-description"
  },
  "defaults": {
    "region": "All UK",
    "source": "Private treaty"
  }
}
```

Use browser dev tools to inspect each listing card on the source site and fill in selectors relative to that card. `urlSelector` can be a plain selector, but the object form is preferred so the scraper can read the `href` attribute. Relative listing URLs are resolved against the page URL.

Selector output maps into the normalized import row fields:

- title
- source URL
- location and extracted postcode
- guide price
- passing rent
- sqft
- asset type
- description as raw context

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

`20260522170000_national_scan_runs.sql` adds scheduled scan tracking:

- `national_scan_runs`
- per-location/source status and result counters
- scan metadata used to rotate the England priority location queue

`20260530130000_watchlist_pipeline_v1.sql` upgrades saved deals into a user-private pipeline:

- adds `user_id`, `status`, `notes`, and `updated_at` to `watchlist_items`
- backfills item owners from `watchlists` and notes from `watchlist_notes`
- enforces one pipeline item per user/deal with `watchlist_items_user_deal_unique`
- restricts item reads/writes with an owner-only RLS policy

All public tables have RLS enabled. User-owned tables are restricted to the authenticated owner. Deal/source/comparable reads are public where they support the product browsing experience; write access is intentionally not granted to `anon`.

## Watchlist Pipeline

Deal cards and detail pages now save deals into "My Pipeline". Each authenticated user gets one private `watchlist_items` row per deal, with a stage of `Saved`, `Reviewing`, `Viewing Booked`, `Offer Submitted`, `Passed`, or `Purchased`. Pipeline notes are stored on the same row and are visible only to that user.

The dashboard shows pipeline counts, active-opportunity analytics, and a pipeline-stage filter that combines with source, confidence, rating, location, and strategy sorting.

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
