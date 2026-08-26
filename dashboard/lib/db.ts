import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __db_pool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__db_pool) {
    global.__db_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
  }
  return global.__db_pool;
}

export const db = getPool();
