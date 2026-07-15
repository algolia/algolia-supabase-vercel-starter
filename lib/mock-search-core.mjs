// Pure logic for the local mock search client — exists so the starter
// renders (and is design-reviewable) before the first Algolia sync.
// Plain JS so `node --test` exercises the exact module the browser runs.

const SEARCHABLE = ["name", "description", "category"];

const PRE = "__ais-highlight__";
const POST = "__/ais-highlight__";

/**
 * @typedef {{ id: number, name: string, description: string, category: string,
 *   price: number, image_url: string, rating: number }} PublicProduct
 * @typedef {string | Array<string | string[]>} FacetFilters
 * @typedef {{ indexName: string, params?: { query?: string, page?: number,
 *   hitsPerPage?: number, facets?: string[], facetFilters?: FacetFilters } }} MockRequest
 */

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {string} value @param {string[]} tokens */
function highlight(value, tokens) {
  if (tokens.length === 0) {
    return { value, matchLevel: "none", matchedWords: [] };
  }
  const re = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  /** @type {string[]} */
  const matched = [];
  const marked = value.replace(re, (m) => {
    matched.push(m.toLowerCase());
    return `${PRE}${m}${POST}`;
  });
  return {
    value: marked,
    matchLevel: matched.length ? "full" : "none",
    matchedWords: Array.from(new Set(matched)),
  };
}

/** @param {PublicProduct} product @param {string[]} tokens */
function matchesQuery(product, tokens) {
  if (tokens.length === 0) return true;
  const haystack = SEARCHABLE.map((f) => product[f]).join(" ").toLowerCase();
  return tokens.every((t) => haystack.includes(t.toLowerCase()));
}

/** @param {PublicProduct} product @param {FacetFilters} [facetFilters] */
function matchesFacetFilters(product, facetFilters) {
  if (!facetFilters) return true;
  const groups = Array.isArray(facetFilters) ? facetFilters : [facetFilters];
  return groups.every((group) => {
    const ors = Array.isArray(group) ? group : [group];
    return ors.some((filter) => {
      const idx = filter.indexOf(":");
      const attr = filter.slice(0, idx);
      const val = filter.slice(idx + 1);
      return String(product[/** @type {keyof PublicProduct} */ (attr)]) === val;
    });
  });
}

/**
 * Drop an attribute's own refinement so its facet counts stay disjunctive
 * (what real Algolia does: selecting "Audio" must not hide the other
 * category counts).
 * @param {FacetFilters | undefined} facetFilters @param {string} attribute
 * @returns {FacetFilters | undefined}
 */
function withoutAttribute(facetFilters, attribute) {
  if (!facetFilters) return undefined;
  const prefix = `${attribute}:`;
  const groups = Array.isArray(facetFilters) ? facetFilters : [facetFilters];
  const kept = groups
    .map((group) => {
      if (typeof group === "string") {
        return group.startsWith(prefix) ? null : group;
      }
      const ors = group.filter((f) => !f.startsWith(prefix));
      return ors.length ? ors : null;
    })
    .filter((g) => g !== null);
  return kept.length ? kept : undefined;
}

/**
 * Mimics one Algolia search request over an in-memory public dataset.
 * @param {PublicProduct[]} products @param {MockRequest} request
 */
export function runRequest(products, { indexName, params = {} }) {
  const query = (params.query ?? "").trim();
  const tokens = query.split(/\s+/).filter(Boolean);
  const hitsPerPage = params.hitsPerPage ?? 20;
  const page = params.page ?? 0;

  const queryMatched = products.filter((p) => matchesQuery(p, tokens));
  const matched = queryMatched.filter((p) =>
    matchesFacetFilters(p, params.facetFilters)
  );

  /** @type {Record<string, Record<string, number>>} */
  const facets = {};
  for (const attr of params.facets ?? []) {
    const scope = queryMatched.filter((p) =>
      matchesFacetFilters(p, withoutAttribute(params.facetFilters, attr))
    );
    /** @type {Record<string, number>} */
    const counts = {};
    for (const product of scope) {
      const value = String(product[/** @type {keyof PublicProduct} */ (attr)]);
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

/**
 * @param {PublicProduct[]} products @param {readonly MockRequest[]} requests
 */
export function runRequests(products, requests) {
  return requests.map((request) => runRequest(products, request));
}
