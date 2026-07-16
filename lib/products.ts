import "server-only";
import { query } from "@/lib/db";

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
  quantity: number;
  updated_at: string;
};

export async function getProduct(id: number): Promise<ProductRow | null> {
  const [row] = await query<ProductRow>(
    "select * from products where id = $1",
    [id],
  );
  return row ?? null;
}
