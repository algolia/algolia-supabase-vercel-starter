import { log } from "./lib/log.mjs";
import { dbClient, ensureSchema, seedProducts } from "./lib/db.mjs";
import { ingestionClient, runSyncAndWait } from "../lib/ingestion.mjs";
import { waitForConnector } from "./lib/connector.mjs";

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

log("3/4", "Looking for the Supabase connector on Algolia…");
const ingestion = ingestionClient();
const taskID = await waitForConnector(ingestion);
log("3/4", "Connector detected — Supabase → transformation → products index.");

log("4/4", "Running first sync…");
const t0 = Date.now();
const run = await runSyncAndWait(ingestion, taskID);
log("4/4", `Sync ${run.outcome} in ${Math.round((Date.now() - t0) / 1000)}s — search is live.`);
