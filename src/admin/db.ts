import sql from "mssql";

let pool: sql.ConnectionPool | undefined;

const dbConfig: sql.config = {
  server: process.env.SQL_SERVER ?? "HXR8-DEV-SQL",
  port: Number(process.env.SQL_PORT ?? 1401),
  user: process.env.SQL_USER ?? "HXR8-DEV-SQL",
  password: process.env.SQL_PASSWORD ?? "12@Sodium2019",

  database: process.env.SQL_DATABASE ?? "PlatformCore",

  options: {
    encrypt: false,
    trustServerCertificate: true,
  },

  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 15000,
    acquireTimeoutMillis: 15000,
  },

  connectionTimeout: 30000,
  requestTimeout: 30000,
};

function enableKeepAlive(p: sql.ConnectionPool): void {
  p.on("connection", (connection) => {
    const socket = connection as unknown as { socket?: import("net").Socket };
    socket.socket?.setKeepAlive(true, 60000);
  });
}

export async function getAdminPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await new sql.ConnectionPool(dbConfig).connect();

    enableKeepAlive(pool);

    pool.on("error", (error) => {
      console.error("SQL connection pool error:", error);
      pool = undefined;
    });
  }

  return pool;
}

export async function closeAdminPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = undefined;
  }
}

export { sql };
