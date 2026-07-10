import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closePool, getPool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");

function splitSqlBatches(sqlText: string): string[] {
  return sqlText
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
}

async function main() {
  const pool = await getPool();

  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SchemaMigrations (
        ID nvarchar(260) NOT NULL PRIMARY KEY,
        AppliedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    END
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const applied = await pool.request().input("id", file).query("SELECT 1 FROM dbo.SchemaMigrations WHERE ID = @id");
    if (applied.recordset.length > 0) {
      continue;
    }

    const sqlText = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const transaction = pool.transaction();
    await transaction.begin();

    try {
      for (const batch of splitSqlBatches(sqlText)) {
        await transaction.request().query(batch);
      }
      await transaction.request().input("id", file).query("INSERT INTO dbo.SchemaMigrations (ID) VALUES (@id)");
      await transaction.commit();
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }

  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
