# Algolia × Supabase × Vercel Starter

A minimal [Next.js](https://nextjs.org) starter for instant, typo-tolerant search
over Postgres data. [Algolia](https://www.algolia.com) indexes and searches the
products, [Supabase](https://supabase.com) stores them, and the
[Algolia connector](https://www.algolia.com/doc/tools/connectors/postgresql/) keeps
the index in sync — no sync code in the app. Deploy it, seed the database, connect
the two from their dashboards, and search is live.

![Screenshot of the starter's search experience](docs/screenshot.png)

**Live demo:** [algolia-supabase-vercel-starter.vercel.app](https://algolia-supabase-vercel-starter.vercel.app)

## Deploy your own

The button installs both integrations on your new project — Supabase provisions a
Postgres database, Algolia provisions an application — and injects their environment
variables. No manual configuration.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?demo-description=A%20production-ready%20template%20for%20typo-tolerant%2C%20instant%20search%20over%20your%20Postgres%20data%2C%20indexed%20to%20Algolia%2C%20deployed%20on%20Vercel.&demo-image=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F2Y56NxW6aX5wFwXZD51qfm%2F20b215c0a1674b39ca5b1eb5b31e5438%2Fimage.png&demo-title=Algolia%20Integration%20Example&demo-url=https%3A%2F%2Falgolia-supabase-vercel-starter.vercel.app%2F&from=templates&products=%255B%257B%2522type%2522%253A%2522integration%2522%252C%2522protocol%2522%253A%2522other%2522%252C%2522productSlug%2522%253A%2522application%2522%252C%2522integrationSlug%2522%253A%2522algolia%2522%257D%252C%257B%2522type%2522%253A%2522integration%2522%252C%2522protocol%2522%253A%2522storage%2522%252C%2522productSlug%2522%253A%2522supabase%2522%252C%2522integrationSlug%2522%253A%2522supabase%2522%257D%255D&project-name=Algolia%20Integration%20Example&repository-name=algolia-integration-example&repository-url=https%3A%2F%2Fgithub.com%2Falgolia%2Falgolia-supabase-vercel-starter)

## Set up the database

Create and seed a `products` table by pasting [`demo/seed.sql`](demo/seed.sql) into
the Supabase **SQL Editor** (open your project → **SQL Editor**) and running it —
this demo uses a 12-column table mixing searchable and internal-only fields.

> The [`demo/`](demo) folder holds the sample dataset and transformation used by
> this walkthrough — replace them with your own data when adapting the template.

## Connect Algolia

Create the connector from the Algolia dashboard → **Data sources** → **Connectors** →
**Supabase**:

1. **Connect Supabase** - connect to Supabase directly to prefill all the database values from the Advanced Configuration section
2. **Transformation** — paste [`demo/transform.js`](demo/transform.js) into the
   wizard's transformation editor; it maps `id` to `objectID`, returns only the
   searchable attributes, and derives `in_stock` from `quantity` — a transformation
   can compute fields, not just strip them. Check the preview: the internal-only
   fields (`cost_price`, `supplier_id`, `internal_notes`, `stock_location`) must be
   gone.
3. **Destination** — set the index name to `products`.
4. **Task** — run a full reindex. Add a schedule if you want recurring syncs.

Reload your deployment — search is live.

## Configure facets

The sidebar filters need faceting enabled. In the Algolia dashboard, open index
`products` → **Configuration** → **Facets** and add:

- `category`, `price`, `rating` — searchable facets for the sidebar
- `in_stock` — set as filter-only (powers the "Hide out of stock" toggle)

## Local development

```bash
git clone https://github.com/algolia/algolia-supabase-vercel-starter && cd algolia-supabase-vercel-starter
npm install
npx vercel link              # link to the project you deployed
npx vercel env pull .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

The integrations inject these environment variables. The Algolia integration may
use bare (`ALGOLIA_*`) or `NEXT_PUBLIC_`-prefixed names — [`next.config.ts`](next.config.ts)
maps either shape. Only the two Algolia search values are exposed to the browser:

| Variable                             | Purpose                                         | Browser-safe?                                                  |
| ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_ALGOLIA_APP_ID`         | Identifies your Algolia application             | ✅ exposed as `NEXT_PUBLIC_ALGOLIA_APP_ID`                     |
| `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` | Search-only key used by the frontend            | ✅ exposed as `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`             |
| `POSTGRES_URL`                       | Supabase connection string for the product page | ❌ server-side only                                            |
| `NEXT_PUBLIC_ALGOLIA_WRITE_API_KEY`  | Indexing key                                    | ❌ unused by the app; the connector indexes from the dashboard |

⚠️ The write key must never be referenced in client code — its `NEXT_PUBLIC_` prefix
would inline it into the browser bundle if referenced. This app never references it.

Key files:

- [`app/page.tsx`](app/page.tsx) — landing page rendering the search experience
- [`components/search/search-experience.tsx`](components/search/search-experience.tsx) — InstantSearch UI (`algoliasearch` lite client)
- [`app/products/[id]/page.tsx`](app/products/[id]/page.tsx) — product page served from Supabase, showing the DB-only fields

## Going to production

- Add authentication before exposing any write path — this template is read-only.
- Enable incremental sync with a soft-delete column so removals propagate to the index.
- Trigger the connector task from the [Ingestion API](https://www.algolia.com/doc/rest-api/ingestion/)
  as a server-side extension instead of the dashboard schedule.

## License

[MIT](LICENSE)
