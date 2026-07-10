import sql from "mssql";

let pool: sql.ConnectionPool | undefined;

export async function getAdminPool(): Promise<sql.ConnectionPool | undefined> {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  if (!pool) {
    pool = await new sql.ConnectionPool(process.env.DATABASE_URL).connect();
  }

  return pool;
}

export { sql };
