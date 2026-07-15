# algolia-supabase-starter — Design

## Goal

Public template + live demo: spin up a full project on Vercel from zero using the
Supabase and Algolia Marketplace integrations, with the Supabase connector on
Algolia keeping the search index in sync. Sibling of `algolia-search-starter`,
one level up in completeness.

## Decisions

- New separate repo: `algolia-supabase-starter` (org `algolia`)
- Scope: CRUD + Search — Supabase is the source of truth, Algolia the search index
- Sync: Supabase connector created on the Algolia side, task in **full reindex
  mode**, run triggered by the app on each CRUD write (+ optional daily schedule)
- Deletes: hard DELETE in Supabase — full reindex makes the index an exact
  mirror of the DB, no per-record delete handling
- Transformation on the connector: strip DB-only fields, only searchable
  attributes reach the index — this is what justifies the connector in the demo
- Connector chain (source + transformation + destination + task) is created
  **once in the Algolia dashboard wizard** — the transformation is authored in
  the dashboard editor (live preview = demo moment); the repo keeps the
  canonical code snippet to paste
- Setup: `npm run setup` scripts the DB (table + seed), prints guided
  dashboard steps for the connector (values derived from env), detects the
  connector, triggers the first run — explicit step-by-step console logs
- Architecture: Next.js Server Actions (insert Supabase → run connector task)
- Design: distinct, duo-brand Supabase green × Algolia indigo, dark-first
- Deliverables: public repo, deployed demo on Vercel team `algolia`, A-Z README

## A-Z user journey

1. Deploy Button → clones repo, installs both Marketplace integrations →
   env vars auto-injected (`POSTGRES_URL`, `SUPABASE_*`, `ALGOLIA_*`)
2. `vercel link && vercel env pull .env.local`
3. `npm run setup` — idempotent, logs each step:
   - create `products` table (SQL over `POSTGRES_URL`)
   - seed ~20 demo products — searchable fields + DB-only fields
     (`cost_price`, `supplier_id`, `internal_notes`, `stock_location`,
     `updated_at`)
   - guide the one-time dashboard creation of the connector: source
     (Supabase, connection values printed from env) → transformation (paste
     the repo's snippet, watch the live preview) → destination (index) →
     task (full reindex); script polls until it detects the connector
   - trigger first run, wait for completion, print indexed count
4. `npm run dev` → live search + admin CRUD

## App structure (Next.js App Router, TS, Tailwind)

- `app/page.tsx` — hero + InstantSearch experience (search-as-you-type, facets:
  category, price)
- `app/products/[id]/page.tsx` — product detail page, server-rendered from
  Supabase (source of truth, shows fields the index doesn't have); search hits
  and admin rows link to it
- `app/admin/page.tsx` — product list + create/edit/delete form
- `app/admin/actions.ts` — server actions: write to Supabase, then trigger
  connector task run, toast "synced to Algolia"
- `lib/supabase.ts` — server-side Supabase client
- `lib/algolia-ingestion.ts` — find task by name, cache ID, `runTask()`
- `scripts/setup.mjs` — the A-Z setup script
- `data/products.json` — demo dataset (searchable + DB-only fields)

## Security

- Server-only: `ALGOLIA_WRITE_API_KEY`, `POSTGRES_URL`
- Browser-exposed: app ID, search-only key
- Admin page unauthenticated (demo scope) — called out in README

## Error handling

- Setup re-runnable without damage (skip existing table/records/connector)
- Missing env var → actionable message naming the integration to install
- Connector run failure after a write: data stays in Supabase, caught up on
  next run — degraded toast, no rollback

## README "Going to production" section

- Full reindex per write does not scale — switch the task to incremental
  updates at scale
- Incremental mode requires soft deletes: `deleted_at` column, transformation
  emits `is_deleted`, filter it out at query time (documented, not implemented)

## Risks / open verification (first plan step)

- Dashboard wizard field names/order for the Supabase connector — capture the
  real flow once to write exact guided steps in the setup script and README.
- Full-reindex run duration on the demo dataset — confirm a few seconds, not
  minutes (drives the CRUD toast UX).
- Deploy Button with two Marketplace products in one `products=[…]` param —
  verify supported syntax.

## Out of scope (V2+, park in TODO_LATER.md)

- Auth on /admin (Supabase Auth)
- Real-time UI updates (Supabase Realtime)
- Incremental sync + soft delete implementation (README doc only)
- Facet configuration UI, analytics, A/B
