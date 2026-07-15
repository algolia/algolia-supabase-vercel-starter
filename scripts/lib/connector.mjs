import { log } from "./log.mjs";
import { INDEX_NAME, findTaskID } from "../../lib/ingestion.mjs";

export function parseDbUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    throw new Error(
      "POSTGRES_URL is not a URL-format connection string (postgres://…) — the dashboard-steps helper needs one",
    );
  }
}

function printDashboardSteps() {
  const url = parseDbUrl(process.env.POSTGRES_URL);
  console.log(
    [
      "",
      "One-time step — create the connector in the Algolia dashboard:",
      `  https://dashboard.algolia.com/apps/${process.env.ALGOLIA_APP_ID}/connectors → Supabase → Connect`,
      `  Host:           ${url.hostname}`,
      "  Ports:          5432 (session) / 6543 (transaction)",
      `  Database:       ${url.pathname.slice(1)}`,
      `  User:           ${url.username}`,
      "  Password:       from POSTGRES_URL in .env.local",
      "  Table:          products      Primary key: id",
      "  Transformation: paste transformations/transform.js — the preview must drop cost_price & co",
      `  Destination:    index "${INDEX_NAME}"   Task: full reindex, on-demand`,
      "",
    ].join("\n"),
  );
}

export async function waitForConnector(client, { pollMs = 10_000 } = {}) {
  const existing = await findTaskID(client);
  if (existing) return existing;
  printDashboardSteps();
  log("3/4", "Waiting — the script continues as soon as the connector exists (Ctrl-C to abort)…");
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs));
    const taskID = await findTaskID(client);
    if (taskID) return taskID;
  }
}
