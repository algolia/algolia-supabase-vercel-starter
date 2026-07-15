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
