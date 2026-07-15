# algolia-supabase-starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public Next.js starter deployed via a Vercel Deploy Button that installs the Supabase + Algolia Marketplace integrations, with a fully scripted setup creating the Supabase→Algolia connector (transformation + full-reindex task) and an app demoing search, product pages, and CRUD-triggered sync.

**Architecture:** Supabase is the source of truth (Postgres `products` table); the Algolia connector (source → transformation → destination → task, `action: replace`) projects it into the `products` index; the app writes to Postgres via Server Actions and pokes the connector task after each write. The connector chain is created once in the Algolia dashboard wizard (transformation authored in the dashboard editor); `npm run setup` scripts the DB, prints guided wizard steps, polls until the connector exists, then runs the first sync — step-by-step logs throughout.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, `algoliasearch` v5 (+ `initIngestion`), `react-instantsearch` v7, `pg` v8, `node --test`.

## Global Constraints

- Repo root: `/Users/lorris.saint-genez/Workspace/Outbound/algolia-supabase-starter` — keep existing `docs/` and `FLOW.md`
- Repo stays **private** (GitHub) until Task 12; public + org transfer is the last step
- Commits: conventional with scope, ONE line, ≤64 chars, **no body, no `Co-Authored-By:` or any AI trailer** (overrides harness defaults)
- NEVER commit: `FLOW.md`, `TODO_LATER.md`, `.env*.local` — all in `.gitignore`
- Never log or echo secret values (keys, `POSTGRES_URL`) in scripts or steps
- Node `>=22` (uses `process.loadEnvFile`)
- Naming: index is `products` (exact string, everywhere). Connector pieces are
  named freely in the dashboard wizard — code NEVER looks anything up by
  connector name: the task is resolved via the destination whose
  `input.indexName === "products"` (tasks have no name field)
- Ingestion region: `process.env.ALGOLIA_INGESTION_REGION ?? "us"`
- Env vars (injected by integrations): `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_API_KEY`, `ALGOLIA_WRITE_API_KEY` (verified: write key ACLs cover ingestion: `addObject`, `deleteIndex`, `editSettings`)
- Supabase key names vary by project generation (`SUPABASE_ANON_KEY` vs `SUPABASE_PUBLISHABLE_KEY`) — scripts must not depend on them; DB access goes through `POSTGRES_URL*` only
- DDL + seed: use `POSTGRES_URL_NON_POOLING ?? POSTGRES_URL` (transaction pooler breaks prepared statements)
- External connector connection: Supabase **session pooler** (IPv4-safe on all tiers), SSL required
- Design: dark-first, duo-brand — Supabase green `#3ECF8E`, Algolia blue `#003DFF`, background `#0a0a0a`
- Verification is manual-first (commands, URLs, expected output); unit tests only where logic is pure (dataset shape, transformation)

---

### Task 1: Scaffold repo

**Files:**
- Create: Next.js scaffold at repo root (`app/`, `next.config.ts`, `tsconfig.json`, `package.json`, …)
- Create: `.gitignore` (extend scaffold's), `.env.example`
- Modify: `package.json` (name, scripts, deps)

**Interfaces:**
- Produces: `npm run setup` → `scripts/setup.mjs` (created Task 4), `npm test` → `node --test`, deps `algoliasearch@^5`, `react-instantsearch@^7`, `pg@^8` available to all later tasks

- [ ] **Step 1: Scaffold Next.js around the existing files**

`create-next-app` refuses non-empty dirs — park the existing files, scaffold, restore:

```bash
cd /Users/lorris.saint-genez/Workspace/Outbound/algolia-supabase-starter
mkdir -p /tmp/ass-park && mv docs FLOW.md /tmp/ass-park/
npx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
mv /tmp/ass-park/docs /tmp/ass-park/FLOW.md .
```

Expected: scaffold succeeds, `docs/` and `FLOW.md` back at root.

- [ ] **Step 2: Set package name, scripts, and deps**

In `package.json`: `"name": "algolia-supabase-starter"`, add:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "setup": "node scripts/setup.mjs",
  "test": "node --test"
},
"engines": { "node": ">=22" }
```

```bash
npm install algoliasearch@^5 react-instantsearch@^7 pg@^8
npm install -D @types/pg
```

- [ ] **Step 3: .gitignore and .env.example**

Append to `.gitignore`:

```
# local-only presenter/parking notes
FLOW.md
TODO_LATER.md
```

(scaffold already ignores `.env*`). Create `.env.example`:

```bash
# Injected by the Supabase integration on Vercel (vercel env pull .env.local)
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=
# Injected by the Algolia integration on Vercel
ALGOLIA_APP_ID=
ALGOLIA_SEARCH_API_KEY=
ALGOLIA_WRITE_API_KEY=
# Optional — Algolia ingestion region (us | eu), defaults to us
ALGOLIA_INGESTION_REGION=
```

- [ ] **Step 4: Map browser-safe env in next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Search key is search-only and safe for the browser.
    // ALGOLIA_WRITE_API_KEY and POSTGRES_URL must NEVER be mapped here.
    NEXT_PUBLIC_ALGOLIA_APP_ID: process.env.ALGOLIA_APP_ID,
    NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY: process.env.ALGOLIA_SEARCH_API_KEY,
  },
};

export default nextConfig;
```

- [ ] **Step 5: Verify build, init git, commit**

```bash
npm run build          # Expected: compiles clean
git init && git add -A
git status --short     # Expected: FLOW.md ABSENT from staged files
git commit -m "chore(scaffold): next 16 app with algolia and pg deps"
git add docs/superpowers && git commit -m "docs(spec): add design spec and plan"
```

---

### Task 2: Demo dataset + SQL schema + shape test

**Files:**
- Create: `data/products.json`, `db/schema.sql`
- Test: `tests/dataset.test.mjs`

**Interfaces:**
- Produces: `data/products.json` — array of 20 objects, exact field contract below; `db/schema.sql` — `products` table DDL consumed by `scripts/lib/db.mjs` (Task 4)

- [ ] **Step 1: Write the failing dataset test**

`tests/dataset.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SEARCHABLE = ["id", "name", "description", "category", "price", "image_url", "rating"];
const DB_ONLY = ["cost_price", "supplier_id", "internal_notes", "stock_location"];

test("dataset: 20 products, full field contract, unique ids", () => {
  const products = JSON.parse(readFileSync(new URL("../data/products.json", import.meta.url), "utf8"));
  assert.equal(products.length, 20);
  const ids = new Set(products.map((p) => p.id));
  assert.equal(ids.size, 20);
  for (const p of products) {
    for (const f of [...SEARCHABLE, ...DB_ONLY]) assert.ok(f in p, `missing ${f} on id ${p.id}`);
    assert.equal(typeof p.id, "number");
    assert.equal(typeof p.price, "number");
    assert.ok(p.cost_price < p.price, `cost_price >= price on id ${p.id}`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — Expected: FAIL (`data/products.json` not found).

- [ ] **Step 3: Write schema and dataset**

`db/schema.sql`:

```sql
create table if not exists products (
  id integer primary key,
  name text not null,
  description text not null,
  category text not null,
  price numeric(10,2) not null,
  image_url text,
  rating numeric(2,1),
  cost_price numeric(10,2),
  supplier_id text,
  internal_notes text,
  stock_location text,
  updated_at timestamptz not null default now()
);
```

`data/products.json`: 20 electronics products, ids 1–20, categories among `Audio`, `Computing`, `Accessories`, `Smart Home`. Exact shape per record (content varies, fields fixed):

```json
{
  "id": 1,
  "name": "Aurora Wireless Headphones",
  "description": "Over-ear noise-cancelling headphones with 30h battery life.",
  "category": "Audio",
  "price": 199.0,
  "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=640",
  "rating": 4.6,
  "cost_price": 87.5,
  "supplier_id": "SUP-ACME-014",
  "internal_notes": "Renegotiate freight Q3. Do not discount below 15%.",
  "stock_location": "WH-EU-2 / Aisle 14"
}
```

(Write 20 realistic records following that contract — no extra keys.)

- [ ] **Step 4: Run tests to verify pass, commit**

```bash
npm test    # Expected: PASS
git add data db tests && git commit -m "feat(data): demo products dataset and pg schema"
```

---

### Task 3: Provision live environment (Vercel + both integrations) — HUMAN GATE

**Files:**
- Create: `.env.local` (via `vercel env pull` — never committed)

**Interfaces:**
- Produces: live Supabase Postgres + Algolia app; `.env.local` with all `POSTGRES_*` and `ALGOLIA_*` vars — required by every later task's verification

- [ ] **Step 1: Push private GitHub repo**

```bash
gh repo create algolia-supabase-starter --private --source . --push
```

(Personal account; org transfer happens in Task 12.)

- [ ] **Step 2: Create Vercel project + install BOTH Marketplace integrations — PAUSE, requires Lorris in dashboards**

Manual, in the Vercel dashboard (document actual clicks for the README later):
1. vercel.com/new → import the GitHub repo → deploy (build may fail — fine, env not seeded yet)
2. Project → Storage/Integrations → install **Supabase** from Marketplace → create database
3. Same → install **Algolia** → create application
4. Note the exact `integrationSlug`/`productSlug` pair shown in each install URL — record them in `docs/captured/deploy-button-slugs.md` for Task 11

- [ ] **Step 3: Pull env and verify var names**

```bash
npx vercel link
npx vercel env pull .env.local
cut -d= -f1 .env.local | sort
```

Expected: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_API_KEY`, `ALGOLIA_WRITE_API_KEY` all present. Record any naming surprises in `docs/captured/env-vars.md`, commit that file only:

```bash
git add docs/captured && git commit -m "docs(captured): record integration slugs and env names"
```

---

### Task 4: DB setup + seed (scripts, tested against live Supabase)

**Files:**
- Create: `scripts/lib/log.mjs`, `scripts/lib/db.mjs`, `scripts/setup.mjs`

**Interfaces:**
- Produces: `log(step, msg)` / `fail(msg)` from `log.mjs`; `ensureSchema()` and `seedProducts()` from `db.mjs` (both return row counts); `scripts/setup.mjs` orchestrator that later tasks extend

- [ ] **Step 1: Logger**

`scripts/lib/log.mjs`:

```js
export function log(step, msg) {
  console.log(`\x1b[36m[${step}]\x1b[0m ${msg}`);
}

export function fail(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
  process.exit(1);
}
```

- [ ] **Step 2: DB module**

`scripts/lib/db.mjs`:

```js
import { readFileSync } from "node:fs";
import pg from "pg";
import { fail } from "./log.mjs";

export function dbClient() {
  const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!url) {
    fail(
      [
        "Missing POSTGRES_URL — injected by the Supabase integration on Vercel.",
        "  1. Install the Supabase integration on your Vercel project",
        "  2. npx vercel link && npx vercel env pull .env.local",
        "then run `npm run setup` again.",
      ].join("\n"),
    );
  }
  return new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
}

export async function ensureSchema(client) {
  const ddl = readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8");
  await client.query(ddl);
}

export async function seedProducts(client) {
  const products = JSON.parse(
    readFileSync(new URL("../../data/products.json", import.meta.url), "utf8"),
  );
  for (const p of products) {
    await client.query(
      `insert into products (id, name, description, category, price, image_url, rating,
                             cost_price, supplier_id, internal_notes, stock_location)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict (id) do update set
         name=excluded.name, description=excluded.description, category=excluded.category,
         price=excluded.price, image_url=excluded.image_url, rating=excluded.rating,
         cost_price=excluded.cost_price, supplier_id=excluded.supplier_id,
         internal_notes=excluded.internal_notes, stock_location=excluded.stock_location,
         updated_at=now()`,
      [p.id, p.name, p.description, p.category, p.price, p.image_url, p.rating,
       p.cost_price, p.supplier_id, p.internal_notes, p.stock_location],
    );
  }
  const { rows } = await client.query("select count(*)::int as n from products");
  return rows[0].n;
}
```

- [ ] **Step 3: Orchestrator (DB half)**

`scripts/setup.mjs`:

```js
import { log, fail } from "./lib/log.mjs";
import { dbClient, ensureSchema, seedProducts } from "./lib/db.mjs";

try { process.loadEnvFile(".env.local"); } catch {}

log("1/4", "Connecting to Supabase Postgres…");
const db = dbClient();
await db.connect();

log("1/4", 'Creating table "products" (skipped if it exists)…');
await ensureSchema(db);

log("2/4", "Seeding demo products (idempotent upsert)…");
const count = await seedProducts(db);
log("2/4", `${count} products in Supabase.`);
await db.end();

log("3/4", "Connector setup — added in the next step of the plan.");
log("4/4", "First sync — added in the next step of the plan.");
```

- [ ] **Step 4: Run against live Supabase, verify, commit**

```bash
npm run setup    # Expected: [1/4]…[2/4] logs, "20 products in Supabase."
npm run setup    # Expected: identical output (idempotent)
```

If SSL errors: try without the `ssl` override first, keep whichever works, note why in a one-line comment.

```bash
git add scripts && git commit -m "feat(setup): create and seed products table"
```

---

### Task 5: Transformation code + unit tests

**Files:**
- Create: `transformations/transform.js`
- Test: `tests/transform.test.mjs`

**Interfaces:**
- Produces: `transformations/transform.js` — bare `async function transform(record, helper)` (Algolia dashboard editor format, no export). Canonical snippet: pasted into the dashboard editor in Task 6, path printed by the setup script (Task 7), shown in the README (Task 11). The repo file is the source of truth the dashboard copy must match.

- [ ] **Step 1: Write the failing test**

`tests/transform.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../transformations/transform.js", import.meta.url), "utf8");
const transform = new vm.Script(`${code}; transform`).runInNewContext();

const row = {
  id: 7, name: "X", description: "Y", category: "Audio", price: "19.90",
  image_url: "https://x/y.jpg", rating: "4.5",
  cost_price: "9.00", supplier_id: "S", internal_notes: "secret", stock_location: "W", updated_at: "2026-01-01",
};

test("keeps only searchable fields, maps id to objectID", async () => {
  const out = await transform({ ...row }, {});
  assert.deepEqual(Object.keys(out).sort(),
    ["category", "description", "image_url", "name", "objectID", "price", "rating"]);
  assert.equal(out.objectID, "7");
});

test("casts pg numerics to numbers", async () => {
  const out = await transform({ ...row }, {});
  assert.equal(out.price, 19.9);
  assert.equal(out.rating, 4.5);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test` — Expected: FAIL (transform.js not found).

- [ ] **Step 3: Implement**

`transformations/transform.js`:

```js
// Allow-list: only searchable attributes reach the index.
// DB-only fields (cost_price, supplier_id, internal_notes, stock_location) never leave Supabase.
// Canonical copy of the code pasted into the Algolia dashboard transformation editor.
async function transform(record, helper) {
  return {
    objectID: String(record.id),
    name: record.name,
    description: record.description,
    category: record.category,
    price: Number(record.price),
    image_url: record.image_url ?? null,
    rating: record.rating == null ? null : Number(record.rating),
  };
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test    # Expected: PASS (dataset + transform)
git add transformations tests && git commit -m "feat(connector): allow-list transformation snippet"
```

---

### Task 6: Create the connector in the Algolia dashboard + capture shapes — HUMAN GATE

**Files:**
- Create: `scripts/dev/capture-connector.mjs`, `docs/captured/connector-shapes.md`

**Interfaces:**
- Consumes: `transformations/transform.js` (Task 5), live env (Task 3)
- Produces: live connector chain (source → transformation → destination → task) on the Algolia app; `docs/captured/connector-shapes.md` — exact wizard field names/order (ground truth for Task 7's printed guidance and the README walkthrough) + captured JSON of all pieces

- [ ] **Step 1: Create the full chain via the dashboard wizard — PAUSE, requires Lorris**

Algolia dashboard → Data sources → Connectors → **Supabase** → Connect:
- Connection: parse from `POSTGRES_URL` in `.env.local` — host, session pooler port 5432, database, user, password
- Table: `products`; primary key: `id`
- **Transformation: paste `transformations/transform.js` in the editor** — verify in the live preview that `cost_price`, `supplier_id`, `internal_notes`, `stock_location` disappear and `objectID` is set
- Destination index: `products`; task: **full reindex**, on-demand trigger
- Note every screen, field label, and default while going — Task 7 and the README replay these steps verbatim

- [ ] **Step 2: Capture script**

`scripts/dev/capture-connector.mjs`:

```js
import { algoliasearch } from "algoliasearch";

try { process.loadEnvFile(".env.local"); } catch {}
const region = process.env.ALGOLIA_INGESTION_REGION ?? "us";
const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_WRITE_API_KEY)
  .initIngestion({ region });

const [sources, destinations, tasks, transformations] = await Promise.all([
  client.listSources(), client.listDestinations(), client.listTasks(), client.listTransformations(),
]);
// Print raw JSON; redact anything password-like before saving to docs.
console.log(JSON.stringify({ sources, destinations, tasks, transformations }, null, 2));
```

- [ ] **Step 3: Run, record findings**

```bash
node scripts/dev/capture-connector.mjs > /tmp/connector-raw.json
```

Write `docs/captured/connector-shapes.md` from it — the wizard walkthrough (screens, field labels, defaults), the captured JSON of source/destination/task/transformation (secret values redacted: `"<redacted>"`), the task `input.streams` shape, where primary-key→objectID lives. Note the source `input.image`/`configuration` keys too — useful if a scripted creation becomes a V2.

- [ ] **Step 4: Commit (redacted docs only)**

```bash
git add scripts/dev docs/captured && git commit -m "docs(captured): connector wizard walkthrough and shapes"
```

---

### Task 7: Connector detection + first sync in `npm run setup`

**Files:**
- Create: `lib/ingestion.mjs` (shared app ↔ scripts), `scripts/lib/connector.mjs`
- Modify: `scripts/setup.mjs` (replace the two stub logs)

**Interfaces:**
- Consumes: wizard walkthrough from `docs/captured/connector-shapes.md` (Task 6 — align the printed guidance with the real field labels), `log` (Task 4)
- Produces: `ingestionClient()`, `resolveTaskID(client)` (cached, lookup via destination `input.indexName`), `runSyncAndWait(client, taskID)` from `lib/ingestion.mjs` — reused by server actions in Task 10

- [ ] **Step 1: Shared ingestion helpers**

`lib/ingestion.mjs`:

```js
import { algoliasearch } from "algoliasearch";

export const INDEX_NAME = "products";

export function ingestionClient() {
  const region = process.env.ALGOLIA_INGESTION_REGION ?? "us";
  return algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_WRITE_API_KEY)
    .initIngestion({ region });
}

// Tasks have no name and dashboard naming is free — resolve through the
// destination that targets our index.
export async function findTaskID(client) {
  const { destinations } = await client.listDestinations();
  const dest = destinations?.find((d) => d.input?.indexName === INDEX_NAME);
  if (!dest) return null;
  const { tasks } = await client.listTasks();
  return tasks?.find((t) => t.destinationID === dest.destinationID)?.taskID ?? null;
}

let cachedTaskID;

export async function resolveTaskID(client) {
  cachedTaskID ??= await findTaskID(client);
  if (!cachedTaskID) throw new Error('No connector task targets "products" — run `npm run setup`');
  return cachedTaskID;
}

export async function runSyncAndWait(client, taskID, { timeoutMs = 120_000 } = {}) {
  const { runID } = await client.runTask({ taskID });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await client.getRun({ runID });
    if (run.status === "finished" || run.status === "skipped") return run;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Sync run ${runID} still not finished after ${timeoutMs / 1000}s`);
}
```

- [ ] **Step 2: Guided-creation module**

`scripts/lib/connector.mjs` — the connector is created by hand in the dashboard (the source shape is not a public API contract; the wizard IS the product being demoed). The script prints exact steps with values derived from env, then polls until the chain exists:

```js
import { log } from "./log.mjs";
import { INDEX_NAME, findTaskID } from "../../lib/ingestion.mjs";

function printDashboardSteps() {
  const url = new URL(process.env.POSTGRES_URL);
  console.log(
    [
      "",
      "One-time step — create the connector in the Algolia dashboard:",
      `  https://dashboard.algolia.com/apps/${process.env.ALGOLIA_APP_ID}/connectors → Supabase → Connect`,
      `  Host:           ${url.hostname}`,
      "  Ports:          5432 (session) / 6543 (transaction)",
      `  Database:       ${url.pathname.slice(1)}`,
      `  User:           ${url.username}`,
      "  Password:       from POSTGRES_URL in .env.local",
      "  Table:          products      Primary key: id",
      "  Transformation: paste transformations/transform.js — the preview must drop cost_price & co",
      `  Destination:    index "${INDEX_NAME}"   Task: full reindex, on-demand`,
      "",
    ].join("\n"),
  );
}

export async function waitForConnector(client, { pollMs = 10_000 } = {}) {
  const existing = await findTaskID(client);
  if (existing) return existing;
  printDashboardSteps();
  log("3/4", "Waiting — the script continues as soon as the connector exists (Ctrl-C to abort)…");
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs));
    const taskID = await findTaskID(client);
    if (taskID) return taskID;
  }
}
```

Align the printed field labels with the real wizard labels recorded in `docs/captured/connector-shapes.md`.

- [ ] **Step 3: Wire into setup.mjs**

Replace the two stub logs:

```js
import { ingestionClient, runSyncAndWait } from "../lib/ingestion.mjs";
import { waitForConnector } from "./lib/connector.mjs";

log("3/4", "Looking for the Supabase connector on Algolia…");
const ingestion = ingestionClient();
const taskID = await waitForConnector(ingestion);
log("3/4", "Connector detected — Supabase → transformation → products index.");

log("4/4", "Running first sync…");
const t0 = Date.now();
const run = await runSyncAndWait(ingestion, taskID);
log("4/4", `Sync ${run.outcome} in ${Math.round((Date.now() - t0) / 1000)}s — search is live.`);
```

- [ ] **Step 4: Verify E2E against live services, commit**

```bash
npm run setup   # Connector exists (Task 6) → detected immediately, sync runs, duration printed
npm run setup   # Expected: identical — fully idempotent
```

To verify the guidance path: temporarily point `ALGOLIA_INGESTION_REGION` at the other region → steps print and the script polls; Ctrl-C, restore. Record the measured full-reindex duration in `docs/captured/connector-shapes.md` (spec open question). Check the Algolia dashboard: index `products` has 20 records, none with `internal_notes`.

```bash
git add scripts lib docs/captured && git commit -m "feat(setup): guided connector detection and first sync"
```

---

### Task 8: Search homepage (duo-brand, dark-first)

**Files:**
- Create: `components/search/search-experience.tsx`, `components/search/product-hit.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_ALGOLIA_APP_ID` / `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY` (Task 1)
- Produces: `<SearchExperience />`; hits link to `/products/${objectID}` (Task 9's route)

- [ ] **Step 1: Design tokens**

In `app/globals.css` (Tailwind 4 `@theme`):

```css
@theme {
  --color-supabase: #3ecf8e;
  --color-algolia: #003dff;
  --color-surface: #0a0a0a;
  --color-card: #141414;
  --color-border-subtle: #262626;
}
```

Dark-first: set `background: var(--color-surface)` on `body`, light text defaults.

- [ ] **Step 2: Search experience component**

`components/search/search-experience.tsx` (client component):

```tsx
"use client";

import { liteClient as algoliasearch } from "algoliasearch/lite";
import { InstantSearch, SearchBox, Hits, RefinementList, Stats, Configure } from "react-instantsearch";
import { ProductHit } from "./product-hit";

const client = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!,
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY!,
);

export function SearchExperience() {
  return (
    <InstantSearch searchClient={client} indexName="products" future={{ preserveSharedStateOnUnmount: true }}>
      <Configure hitsPerPage={12} />
      <SearchBox placeholder="Try “headphones”…" autoFocus />
      <div className="flex gap-8">
        <aside className="w-56 shrink-0">
          <h3>Category</h3>
          <RefinementList attribute="category" />
        </aside>
        <main className="flex-1">
          <Stats />
          <Hits hitComponent={ProductHit} classNames={{ list: "grid grid-cols-2 lg:grid-cols-3 gap-4" }} />
        </main>
      </div>
    </InstantSearch>
  );
}
```

`components/search/product-hit.tsx`:

```tsx
import Link from "next/link";
import { Highlight, type Hit } from "react-instantsearch";

type Product = { name: string; description: string; category: string; price: number; image_url: string | null; rating: number | null };

export function ProductHit({ hit }: { hit: Hit<Product> }) {
  return (
    <Link href={`/products/${hit.objectID}`} className="block rounded-lg border border-border-subtle bg-card p-4 hover:border-supabase">
      {hit.image_url && <img src={hit.image_url} alt="" className="mb-3 aspect-square w-full rounded object-cover" />}
      <h2 className="font-medium"><Highlight attribute="name" hit={hit} /></h2>
      <p className="text-sm opacity-70"><Highlight attribute="description" hit={hit} /></p>
      <div className="mt-2 flex justify-between text-sm">
        <span>{hit.category}</span>
        <span className="font-semibold">${hit.price}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Page + layout**

`app/page.tsx`: hero (title, one-liner "Supabase stores it. Algolia finds it. Vercel wires them.", duo-brand gradient accent: `linear-gradient(90deg, #3ecf8e, #003dff)` on a text span or underline), `<SearchExperience />` directly under, link to `/admin`. `app/layout.tsx`: metadata title "Algolia × Supabase starter", dark body class. Facet/searchbox styling via `classNames` props + globals.css — instantsearch default CSS not imported; style the few widget classes used.

- [ ] **Step 4: Verify in a real browser, commit**

```bash
npm run dev
```

Check http://localhost:3000 — search-as-you-type works, category facet filters, hit cards render images, no console errors, network calls go to `*-dsn.algolia.net`. Screenshot for later README.

```bash
git add app components && git commit -m "feat(search): instantsearch homepage with facets"
```

---

### Task 9: Product detail page (rendered from Supabase)

**Files:**
- Create: `lib/db.ts`, `app/products/[id]/page.tsx`

**Interfaces:**
- Consumes: hit links `/products/${objectID}` (Task 8)
- Produces: `query<T>(text, params)` from `lib/db.ts` — reused by Task 10

- [ ] **Step 1: DB helper for the app**

`lib/db.ts`:

```ts
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}
```

(Runtime uses the pooled URL — fine for single queries; mirror Task 4's SSL finding.)

- [ ] **Step 2: Product page**

`app/products/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";

type ProductRow = {
  id: number; name: string; description: string; category: string; price: string;
  image_url: string | null; rating: string | null;
  cost_price: string | null; supplier_id: string | null;
  internal_notes: string | null; stock_location: string | null; updated_at: string;
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [product] = await query<ProductRow>("select * from products where id = $1", [id]);
  if (!product) notFound();

  return (
    <article>
      <Link href="/">← Back to search</Link>
      {product.image_url && <img src={product.image_url} alt="" />}
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <p>{product.category} — ${product.price} — ★ {product.rating}</p>

      <section className="rounded-lg border border-supabase/40 p-4">
        <h2>Only in the database</h2>
        <p className="text-sm opacity-70">
          These fields live in Supabase but never reach the Algolia index — the
          connector transformation strips them.
        </p>
        <dl>
          <dt>Cost price</dt><dd>${product.cost_price}</dd>
          <dt>Supplier</dt><dd>{product.supplier_id}</dd>
          <dt>Stock location</dt><dd>{product.stock_location}</dd>
          <dt>Internal notes</dt><dd>{product.internal_notes}</dd>
        </dl>
      </section>
    </article>
  );
}
```

Style to match Task 8 (card surfaces, duo-brand accents). The "Only in the database" panel is the demo's talking point — make it visually distinct (Supabase green border).

- [ ] **Step 3: Verify in browser, commit**

From the homepage, click a hit → product page shows DB-only fields; `/products/999` → 404; `/products/abc` → 404.

```bash
git add app lib && git commit -m "feat(products): detail page served from supabase"
```

---

### Task 10: Admin CRUD + sync trigger

**Files:**
- Create: `app/admin/page.tsx`, `app/admin/actions.ts`, `components/admin/product-form.tsx`, `components/admin/product-row.tsx`

**Interfaces:**
- Consumes: `query` (Task 9), `ingestionClient`/`resolveTaskID` (Task 7)
- Produces: server actions `saveProduct(formData)` (insert or update by presence of `id`) and `deleteProduct(formData)` — both return `{ ok: boolean; message: string }`

- [ ] **Step 1: Server actions**

`app/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { ingestionClient, resolveTaskID } from "@/lib/ingestion.mjs";

async function triggerSync(): Promise<string> {
  try {
    const client = ingestionClient();
    const taskID = await resolveTaskID(client);
    await client.runTask({ taskID });
    return "synced to Algolia (full reindex running)";
  } catch (e) {
    return "saved in Supabase — search catches up on the next connector run";
  }
}

export async function saveProduct(_prev: unknown, formData: FormData) {
  const id = formData.get("id");
  const fields = ["name", "description", "category", "price", "image_url", "rating",
    "cost_price", "supplier_id", "internal_notes", "stock_location"].map((k) => formData.get(k));
  if (id) {
    await query(
      `update products set name=$2, description=$3, category=$4, price=$5, image_url=$6,
       rating=$7, cost_price=$8, supplier_id=$9, internal_notes=$10, stock_location=$11,
       updated_at=now() where id=$1`,
      [id, ...fields],
    );
  } else {
    await query(
      `insert into products (id, name, description, category, price, image_url, rating,
                             cost_price, supplier_id, internal_notes, stock_location)
       values ((select coalesce(max(id),0)+1 from products),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      fields,
    );
  }
  const message = await triggerSync();
  revalidatePath("/admin");
  return { ok: true, message };
}

export async function deleteProduct(_prev: unknown, formData: FormData) {
  await query("delete from products where id = $1", [formData.get("id")]);
  const message = await triggerSync();
  revalidatePath("/admin");
  return { ok: true, message };
}
```

- [ ] **Step 2: Admin page + form components**

`app/admin/page.tsx` (server component): heading + "writes go to Supabase, the connector mirrors them into Algolia" subtitle, `<ProductForm />` (create), table of `select id, name, category, price from products order by id` rows via `<ProductRow>` (edit-in-place form + delete button). `components/admin/product-form.tsx` and `product-row.tsx` are client components using `useActionState(saveProduct)` / `useActionState(deleteProduct)`; render `state.message` inline (accent green on ok) — lightweight toast, no extra dep. All fields of the contract editable; DB-only inputs grouped under a "Database-only fields" fieldset (Supabase green border, same talking point as Task 9).

- [ ] **Step 3: Verify the full loop in a real browser**

1. `/admin` → add product "Demo Mic 3000" → message "synced to Algolia…"
2. Homepage → search "demo mic" → appears (allow a few seconds; full reindex)
3. Edit its price → search again → updated; check `internal_notes` NOT in the hit's JSON (network tab)
4. Delete it → search → gone
5. Algolia dashboard → connector run history shows one run per action

- [ ] **Step 4: Commit**

```bash
git add app components && git commit -m "feat(admin): crud with connector-triggered sync"
```

---

### Task 11: README + Deploy Button + production notes

**Files:**
- Create: `README.md` (replace scaffold's), `LICENSE` (MIT), `docs/screenshot.png`

**Interfaces:**
- Consumes: slugs from `docs/captured/deploy-button-slugs.md` (Task 3), measured sync duration (Task 7)

- [ ] **Step 1: Write README**

Follow `algolia-search-starter/README.md`'s tone (short titles, imperative lists). Sections:
- Intro: what it demoes (2 integrations + connector + transformation), live demo link, screenshot
- **Deploy your own**: Deploy Button using the documented `stores=` param with BOTH integrations, slugs verbatim from `docs/captured/deploy-button-slugs.md`:
  `stores=[{"type":"integration","integrationSlug":"<supabase-slug>","productSlug":"<supabase-product>","protocol":"storage"},{"type":"integration","integrationSlug":"algolia","productSlug":"application","protocol":"storage"}]` (URL-encoded)
- **After deploy**: clone → `npm install` → `npx vercel link` → `npx vercel env pull .env.local` → `npm run setup` (paste real log output) — the script guides the one-time connector creation in the Algolia dashboard (wizard walkthrough with the real field labels from `docs/captured/connector-shapes.md`, transformation snippet to paste) and resumes by itself → done
- **How it works**: data-flow diagram (DB → connector → transformation → index), env var table (browser-safe column, like the sibling README), file map
- **Going to production**: full reindex per write doesn't scale — switch task `action` to `partial` + incremental `syncMode`, add `deleted_at` soft deletes, transformation emits `is_deleted`, filter at query time
- Learn more + License

- [ ] **Step 2: Verify the Deploy Button URL**

Open the button URL in a browser (logged out of the algolia team): both integrations appear in the create flow. If `stores=` misbehaves, test the legacy `products=` param (worked for the sibling starter) and keep the working one, noting which in the README comment.

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE docs && git commit -m "docs(readme): a-z deploy and setup walkthrough"
```

---

### Task 12: Final E2E from scratch + publish — HUMAN GATE

**Files:**
- None (operations + fixes only)

- [ ] **Step 1: Repo public + transfer decision — PAUSE, requires Lorris**

Make the repo public; transfer to `github.com/algolia` if that's where it should live (same home as `algolia-search-starter`).

- [ ] **Step 2: Fresh A-Z run**

On a clean Vercel project (or scratch team): click the README Deploy Button → install both integrations → clone fresh → `vercel link` + `env pull` → `npm run setup` → `npm run dev`. Time each phase; update `FLOW.md` timings if off.

- [ ] **Step 3: Production demo**

Verify the Vercel production URL serves search + `/admin` + product pages. Run the FLOW.md script once end-to-end against production (CRUD → sync → search).

- [ ] **Step 4: Close out**

- Update `docs/captured/*` with anything the fresh run contradicted
- `git push`, confirm demo URL in README matches production
- Park any V2 ideas in `TODO_LATER.md` (never committed)
