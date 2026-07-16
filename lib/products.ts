import "server-only";
import { query } from "@/lib/db";
import products from "@/data/products.json";

export type ProductRow = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: string;
  image_url: string | null;
  rating: string | null;
  cost_price: string | null;
  supplier_id: string | null;
  internal_notes: string | null;
  stock_location: string | null;
  updated_at: string;
};

// Fallback exists so the starter renders before Supabase is connected — same
// pattern as lib/search-client.ts. Server-only: the full dataset (DB-only
// fields) must never reach a client component.
const PLACEHOLDER_UPDATED_AT = "2024-01-01T00:00:00.000Z";

type LocalProduct = (typeof products)[number];

function mapLocal(p: LocalProduct): ProductRow {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: String(p.price),
    image_url: p.image_url ?? null,
    rating: p.rating != null ? String(p.rating) : null,
    cost_price: p.cost_price != null ? String(p.cost_price) : null,
    supplier_id: p.supplier_id ?? null,
    internal_notes: p.internal_notes ?? null,
    stock_location: p.stock_location ?? null,
    updated_at: PLACEHOLDER_UPDATED_AT,
  };
}

export async function getProduct(id: number): Promise<ProductRow | null> {
  if (process.env.POSTGRES_URL) {
    const [row] = await query<ProductRow>(
      "select * from products where id = $1",
      [id],
    );
    return row ?? null;
  }
  const p = products.find((row) => row.id === id);
  return p ? mapLocal(p) : null;
}
