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
