import sql from "mssql";

let pool: sql.ConnectionPool | undefined;

export async function getPool(databaseUrl = process.env.DATABASE_URL): Promise<sql.ConnectionPool> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  if (!pool) {
    pool = await new sql.ConnectionPool(databaseUrl).connect();
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.close();
  pool = undefined;
}

export { sql };
