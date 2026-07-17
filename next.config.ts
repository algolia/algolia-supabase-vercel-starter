import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // The Algolia integration may inject bare or NEXT_PUBLIC-prefixed names.
    // Search key is search-only and safe for the browser.
    // The write key must NEVER be referenced in client code (a NEXT_PUBLIC
    // prefix would inline it if referenced — this app never references it).
    // POSTGRES_URL must NEVER be mapped here.
    NEXT_PUBLIC_ALGOLIA_APP_ID:
      process.env.ALGOLIA_APP_ID ?? process.env.NEXT_PUBLIC_ALGOLIA_APP_ID,
    NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY:
      process.env.ALGOLIA_SEARCH_API_KEY ??
      process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY,
  },
};

export default nextConfig;
