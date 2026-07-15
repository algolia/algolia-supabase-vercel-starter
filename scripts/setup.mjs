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
