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
