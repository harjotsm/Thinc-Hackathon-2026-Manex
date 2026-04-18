import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), "web/.env.local"), override: false });

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");
const PG_URL = process.env.MANEX_PG_URL;
if (!PG_URL) {
  console.error("MANEX_PG_URL not set");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: PG_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS resolve_migration_history (
      filename   TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const { rows: applied } = await client.query<{ filename: string; checksum: string }>(
    `SELECT filename, checksum FROM resolve_migration_history`,
  );
  const appliedMap = new Map(applied.map((r) => [r.filename, r.checksum]));

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const fullPath = resolve(MIGRATIONS_DIR, file);
    const sql = readFileSync(fullPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");

    const existing = appliedMap.get(file);
    if (existing === checksum) {
      console.log(`= ${file}`);
      skippedCount++;
      continue;
    }
    if (existing && existing !== checksum) {
      console.error(`! ${file} \u2014 checksum mismatch (was ${existing.slice(0, 8)}, now ${checksum.slice(0, 8)})`);
      console.error("  Refusing to re-apply a modified migration. If intentional, delete the row from resolve_migration_history manually.");
      await client.end();
      process.exit(2);
    }

    console.log(`+ ${file} (${checksum.slice(0, 8)})`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO resolve_migration_history(filename, checksum) VALUES($1, $2)`,
        [file, checksum],
      );
      await client.query("COMMIT");
      appliedCount++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`x ${file} \u2014 ${(err as Error).message}`);
      await client.end();
      process.exit(3);
    }
  }

  console.log(`\napplied=${appliedCount} skipped=${skippedCount} total=${files.length}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
