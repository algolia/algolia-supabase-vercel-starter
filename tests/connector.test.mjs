import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDbUrl } from "../scripts/lib/connector.mjs";

test("parseDbUrl: libpq keyword form throws without leaking the input", () => {
  const raw = "host=x user=u password=SECRET123 dbname=d";
  let error;
  try {
    parseDbUrl(raw);
  } catch (e) {
    error = e;
  }
  assert.ok(error instanceof Error);
  const rendered = String(error) + JSON.stringify(error, Object.getOwnPropertyNames(error));
  assert.ok(!rendered.includes("SECRET123"));
  assert.ok(!rendered.includes("password="));
  assert.match(error.message, /not a URL-format connection string/);
});

test("parseDbUrl: URL form parses hostname/pathname/username", () => {
  const url = parseDbUrl("postgres://user:pw@host:5432/db");
  assert.equal(url.hostname, "host");
  assert.equal(url.pathname, "/db");
  assert.equal(url.username, "user");
});
