import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runRequest, runRequests } from "../lib/mock-search-core.mjs";

const products = JSON.parse(
  readFileSync(new URL("../data/products.public.json", import.meta.url), "utf8")
);

const PRE = "__ais-highlight__";
const POST = "__/ais-highlight__";
const ALL_COUNTS = { Audio: 4, Accessories: 5, Computing: 6, "Smart Home": 5 };

test("mock: empty query returns coherent paginated response", () => {
  const res = runRequest(products, {
    indexName: "products",
    params: { facets: ["category"], hitsPerPage: 12 },
  });
  assert.equal(res.nbHits, 20);
  assert.equal(res.hits.length, 12);
  assert.equal(res.page, 0);
  assert.equal(res.nbPages, 2);
  assert.equal(res.hitsPerPage, 12);
  assert.equal(res.processingTimeMS, 1);
  assert.deepEqual(res.facets.category, ALL_COUNTS);
});

test("mock: query filters case-insensitively and highlights matches", () => {
  const res = runRequest(products, {
    indexName: "products",
    params: { query: "HEADPHONES" },
  });
  assert.ok(res.nbHits >= 1 && res.nbHits < 20);
  for (const hit of res.hits) {
    assert.equal(hit.objectID, String(hit.id));
    assert.match(
      hit._highlightResult.name.value + hit._highlightResult.description.value,
      new RegExp(`${PRE}headphones${POST}`, "i")
    );
  }
});

test("mock: refined category keeps disjunctive counts for all categories", () => {
  const res = runRequest(products, {
    indexName: "products",
    params: { facets: ["category"], facetFilters: [["category:Audio"]] },
  });
  assert.equal(res.nbHits, 4);
  assert.ok(res.hits.every((h) => h.category === "Audio"));
  // The refined attribute's own filter must NOT shrink its facet counts.
  assert.deepEqual(res.facets.category, ALL_COUNTS);
});

test("mock: multi-select OR within the category group", () => {
  const res = runRequest(products, {
    indexName: "products",
    params: {
      facets: ["category"],
      facetFilters: [["category:Audio", "category:Computing"]],
    },
  });
  assert.equal(res.nbHits, 10);
  assert.deepEqual(res.facets.category, ALL_COUNTS);
});

test("mock: query + refinement — counts follow the query, not the refinement", () => {
  const query = "wireless";
  const expected = {};
  for (const p of products) {
    const hay = `${p.name} ${p.description} ${p.category}`.toLowerCase();
    if (hay.includes(query)) expected[p.category] = (expected[p.category] ?? 0) + 1;
  }
  const res = runRequest(products, {
    indexName: "products",
    params: { query, facets: ["category"], facetFilters: [["category:Audio"]] },
  });
  assert.ok(res.hits.every((h) => h.category === "Audio"));
  assert.deepEqual(res.facets.category, expected);
});

test("mock: other attributes' filters still apply to facet counts", () => {
  // Refining another attribute must narrow category counts (only the
  // attribute's OWN group is excluded from its counts).
  const res = runRequest(products, {
    indexName: "products",
    params: {
      facets: ["category"],
      facetFilters: [["category:Audio"], ["rating:4.6"]],
    },
  });
  const rated = products.filter((p) => p.rating === 4.6);
  const expected = {};
  for (const p of rated) expected[p.category] = (expected[p.category] ?? 0) + 1;
  assert.deepEqual(res.facets.category, expected);
});

test("mock: hits never carry DB-only fields", () => {
  const res = runRequest(products, { indexName: "products", params: {} });
  for (const hit of res.hits) {
    for (const secret of ["cost_price", "supplier_id", "internal_notes", "stock_location"]) {
      assert.ok(!(secret in hit), `${secret} leaked into hits`);
    }
  }
});

test("mock: runRequests maps one response per request", () => {
  const res = runRequests(products, [
    { indexName: "products", params: { query: "lamp" } },
    { indexName: "products", params: { facets: ["category"], hitsPerPage: 0 } },
  ]);
  assert.equal(res.length, 2);
  assert.equal(res[1].hits.length, 0);
  assert.deepEqual(res[1].facets.category, ALL_COUNTS);
});
