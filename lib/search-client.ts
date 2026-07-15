import { liteClient } from "algoliasearch/lite";
import type { SearchClient } from "instantsearch.js";
// Public projection only — mirrors the connector transformation's allow-list.
// data/products.json (cost_price, supplier_id, internal_notes, stock_location)
// must never be imported from client-reachable code; a test keeps both files
// in sync.
import products from "@/data/products.public.json";
import { runRequests } from "./mock-search-core.mjs";

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY;

// Local mock of the InstantSearch `search(requests)` contract — exists so the
// starter renders before the first sync to Algolia. Swapped for the real
// client as soon as the Algolia env vars are present.
function createMockClient(): SearchClient {
  return {
    search(requests: Parameters<typeof runRequests>[1]) {
      return Promise.resolve({ results: runRequests(products, requests) });
    },
  } as unknown as SearchClient;
}

export const isMockClient = !appId;

export const searchClient: SearchClient = appId
  ? (liteClient(appId, apiKey ?? "") as unknown as SearchClient)
  : createMockClient();
