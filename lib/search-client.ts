import { liteClient } from "algoliasearch/lite";
import type { SearchClient } from "instantsearch.js";
import dataset from "@/data/products.json";

// Fields that live in Algolia's index. DB-only columns (cost_price,
// supplier_id, internal_notes, stock_location) stay in Postgres and are
// intentionally never exposed to the browser.
const SEARCHABLE = ["name", "description", "category"] as const;

type Product = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  rating: number;
};

const PRE = "__ais-highlight__";
const POST = "__/ais-highlight__";

const products: Product[] = (dataset as Product[]).map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  price: p.price,
  image_url: p.image_url,
  rating: p.rating,
}));

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const apiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(value: string, tokens: string[]) {
  if (tokens.length === 0) {
    return { value, matchLevel: "none" as const, matchedWords: [] as string[] };
  }
  const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  const matched: string[] = [];
  const marked = value.replace(re, (m) => {
    matched.push(m.toLowerCase());
    return `${PRE}${m}${POST}`;
  });
  return {
    value: marked,
    matchLevel: matched.length ? ("full" as const) : ("none" as const),
    matchedWords: Array.from(new Set(matched)),
  };
}

type FacetFilters = string | Array<string | string[]>;

function matchesFacetFilters(product: Product, facetFilters?: FacetFilters) {
  if (!facetFilters) return true;
  const groups = Array.isArray(facetFilters) ? facetFilters : [facetFilters];
  return groups.every((group) => {
    const ors = Array.isArray(group) ? group : [group];
    return ors.some((filter) => {
      const idx = filter.indexOf(":");
      const attr = filter.slice(0, idx) as keyof Product;
      const val = filter.slice(idx + 1);
      return String(product[attr]) === val;
    });
  });
}

type MockRequest = {
  indexName: string;
  params?: {
    query?: string;
    page?: number;
    hitsPerPage?: number;
    facets?: string[];
    facetFilters?: FacetFilters;
  };
};

function runRequest({ indexName, params = {} }: MockRequest) {
  const query = (params.query ?? "").trim();
  const tokens = query.split(/\s+/).filter(Boolean);
  const hitsPerPage = params.hitsPerPage ?? 20;
  const page = params.page ?? 0;

  const matched = products.filter((product) => {
    if (!matchesFacetFilters(product, params.facetFilters)) return false;
    if (tokens.length === 0) return true;
    const haystack = SEARCHABLE.map((f) => product[f]).join(" ").toLowerCase();
    return tokens.every((t) => haystack.includes(t.toLowerCase()));
  });

  const facets: Record<string, Record<string, number>> = {};
  for (const attr of params.facets ?? []) {
    const counts: Record<string, number> = {};
    for (const product of matched) {
      const value = String(product[attr as keyof Product]);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    facets[attr] = counts;
  }

  const start = page * hitsPerPage;
  const hits = matched.slice(start, start + hitsPerPage).map((product) => ({
    ...product,
    objectID: String(product.id),
    _highlightResult: {
      name: highlight(product.name, tokens),
      description: highlight(product.description, tokens),
    },
  }));

  return {
    hits,
    nbHits: matched.length,
    page,
    nbPages: Math.max(1, Math.ceil(matched.length / hitsPerPage)),
    hitsPerPage,
    processingTimeMS: 1,
    query,
    params: "",
    index: indexName,
    exhaustiveNbHits: true,
    exhaustiveFacetsCount: true,
    facets: Object.keys(facets).length ? facets : undefined,
  };
}

function createMockClient(): SearchClient {
  return {
    search(requests: readonly MockRequest[]) {
      return Promise.resolve({ results: requests.map(runRequest) });
    },
  } as unknown as SearchClient;
}

export const isMockClient = !appId;

export const searchClient: SearchClient = appId
  ? (liteClient(appId, apiKey ?? "") as unknown as SearchClient)
  : createMockClient();
