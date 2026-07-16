import { Pool } from "pg";

// Lazy-init so importing this module is safe before POSTGRES_URL is set.
let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    // Supabase URLs carry sslmode=require, which pg escalates to verify-full
    // and lets override this ssl object — strip it so rejectUnauthorized
    // applies (the pooler presents a self-signed chain).
    const url = new URL(process.env.POSTGRES_URL!);
    url.searchParams.delete("sslmode");
    pool = new Pool({
      connectionString: url.toString(),
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
