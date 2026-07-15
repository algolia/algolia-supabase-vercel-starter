import { Pool } from "pg";

// Lazy-init so importing this module is safe before POSTGRES_URL is set.
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await getPool().query(text, params);
  return rows as T[];
}
