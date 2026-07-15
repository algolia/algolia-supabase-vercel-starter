import { algoliasearch } from "algoliasearch";

export const INDEX_NAME = "products";

export function ingestionClient() {
  const region = process.env.ALGOLIA_INGESTION_REGION ?? "us";
  return algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_WRITE_API_KEY)
    .initIngestion({ region });
}

// Tasks have no name and dashboard naming is free — resolve through the
// destination that targets our index.
export async function findTaskID(client) {
  const { destinations } = await client.listDestinations();
  const dest = destinations?.find((d) => d.input?.indexName === INDEX_NAME);
  if (!dest) return null;
  const { tasks } = await client.listTasks();
  return tasks?.find((t) => t.destinationID === dest.destinationID)?.taskID ?? null;
}

let cachedTaskID;

export async function resolveTaskID(client) {
  cachedTaskID ??= await findTaskID(client);
  if (!cachedTaskID) throw new Error('No connector task targets "products" — run `npm run setup`');
  return cachedTaskID;
}

export async function runSyncAndWait(client, taskID, { timeoutMs = 120_000 } = {}) {
  const { runID } = await client.runTask({ taskID });
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await client.getRun({ runID });
    if (run.status === "finished" || run.status === "skipped") return run;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Sync run ${runID} still not finished after ${timeoutMs / 1000}s`);
}
