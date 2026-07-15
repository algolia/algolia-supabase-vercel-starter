"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { ingestionClient, resolveTaskID } from "@/lib/ingestion.mjs";

export type ActionState = { ok: boolean; message: string };

const NOT_CONNECTED =
  "Supabase is not connected — install the integration and run npm run setup to enable writes";

async function triggerSync(): Promise<string> {
  try {
    const client = ingestionClient();
    const taskID = await resolveTaskID(client);
    await client.runTask({ taskID });
    return "synced to Algolia (full reindex running)";
  } catch {
    return "saved in Supabase — search catches up on the next connector run";
  }
}

export async function saveProduct(
  _prev: unknown,
  formData: FormData,
): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { ok: false, message: NOT_CONNECTED };

  const id = formData.get("id");
  const fields = [
    "name",
    "description",
    "category",
    "price",
    "image_url",
    "rating",
    "cost_price",
    "supplier_id",
    "internal_notes",
    "stock_location",
  ].map((k) => formData.get(k));

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

export async function deleteProduct(
  _prev: unknown,
  formData: FormData,
): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { ok: false, message: NOT_CONNECTED };

  await query("delete from products where id = $1", [formData.get("id")]);
  const message = await triggerSync();
  revalidatePath("/admin");
  return { ok: true, message };
}
