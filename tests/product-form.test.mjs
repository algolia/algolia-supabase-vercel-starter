import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProductForm,
  PRODUCT_FIELDS,
} from "../lib/product-form.mjs";

const valid = {
  name: "Demo Mic 3000", description: "A mic.", category: "Audio",
  price: "49.99", image_url: "https://x/y.jpg", rating: "4.5",
  cost_price: "20.00", supplier_id: "SUP-1", internal_notes: "n",
  stock_location: "WH-1",
};

test("normalize: valid input passes through in SQL column order", () => {
  const { values, error } = normalizeProductForm(valid);
  assert.equal(error, undefined);
  assert.deepEqual(PRODUCT_FIELDS.map((k) => values[k]),
    PRODUCT_FIELDS.map((k) => valid[k]));
});

test("normalize: blank optional numerics and text become null", () => {
  const { values, error } = normalizeProductForm({
    ...valid, rating: "", cost_price: " ", image_url: "",
    supplier_id: "", internal_notes: "", stock_location: "",
  });
  assert.equal(error, undefined);
  for (const k of ["rating", "cost_price", "image_url", "supplier_id",
    "internal_notes", "stock_location"]) {
    assert.equal(values[k], null, k);
  }
});

test("normalize: missing or non-string values become null", () => {
  const { values } = normalizeProductForm({ ...valid, rating: undefined });
  assert.equal(values.rating, null);
});

test("normalize: invalid price is rejected", () => {
  for (const price of ["abc", "", "-5", "0", undefined]) {
    const { error } = normalizeProductForm({ ...valid, price });
    assert.equal(error, "Price must be a positive number", String(price));
  }
});

test("normalize: non-numeric optional numerics are rejected when present", () => {
  assert.equal(normalizeProductForm({ ...valid, rating: "hot" }).error,
    "Rating must be a number");
  assert.equal(normalizeProductForm({ ...valid, cost_price: "cheap" }).error,
    "Cost price must be a number");
});
