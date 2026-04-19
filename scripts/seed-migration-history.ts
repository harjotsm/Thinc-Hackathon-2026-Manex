import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
const client = new Client({ connectionString: process.env.MANEX_PG_URL });

async function main() {
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS resolve_migration_history (filename TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const existing = [
    "00001_create_schema.sql",
    "00002_create_views.sql",
    "00003_resolve_core.sql",
    "00004_resolve_workflow_atomic.sql",
    "00005_resolve_semantic_helpers.sql",
  ];
  for (const f of existing) {
    const sql = readFileSync(resolve("supabase/migrations", f), "utf8");
    const cs = createHash("sha256").update(sql).digest("hex");
    await client.query(
      `INSERT INTO resolve_migration_history(filename, checksum) VALUES($1, $2) ON CONFLICT (filename) DO NOTHING`,
      [f, cs],
    );
    console.log(`seed ${f} ${cs.slice(0, 8)}`);
  }
  await client.end();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
