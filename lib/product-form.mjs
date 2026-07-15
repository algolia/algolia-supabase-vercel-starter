// Column order of the admin insert/update SQL.
export const PRODUCT_FIELDS = [
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
];

const NUMERIC_OPTIONAL = [
  ["rating", "Rating"],
  ["cost_price", "Cost price"],
];

// Lives outside actions.ts ("use server" forbids sync exports) so node --test
// can exercise it. Blank inputs become NULL — Postgres rejects '' for numerics
// and lib/products.ts treats missing text fields as null.
/**
 * @param {Record<string, unknown>} raw
 * @returns {{ error: string, values?: undefined }
 *         | { error?: undefined, values: Record<string, string | null> }}
 */
export function normalizeProductForm(raw) {
  /** @type {Record<string, string | null>} */
  const values = {};
  for (const key of PRODUCT_FIELDS) {
    const v = raw[key];
    const s = typeof v === "string" ? v.trim() : "";
    values[key] = s === "" ? null : s;
  }
  const price = Number(values.price);
  if (values.price == null || !Number.isFinite(price) || price <= 0) {
    return { error: "Price must be a positive number" };
  }
  for (const [key, label] of NUMERIC_OPTIONAL) {
    if (values[key] != null && !Number.isFinite(Number(values[key]))) {
      return { error: `${label} must be a number` };
    }
  }
  return { values };
}
