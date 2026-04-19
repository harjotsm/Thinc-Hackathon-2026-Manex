import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";
import { PostgrestClient } from "@supabase/postgrest-js";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), "web/.env.local"), override: false });

const { MANEX_API_URL, MANEX_ANON_KEY, MANEX_SERVICE_ROLE_KEY, MANEX_PG_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY } = process.env;

type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: "pg direct connection",
    async run() {
      if (!MANEX_PG_URL) throw new Error("MANEX_PG_URL not set");
      const c = new Client({ connectionString: MANEX_PG_URL });
      await c.connect();
      const { rows } = await c.query("SELECT current_database() AS db, current_user AS usr, version() AS v");
      await c.end();
      return `db=${rows[0].db} user=${rows[0].usr}`;
    },
  },
  {
    name: "PostgREST (Manex root-mounted)",
    async run() {
      const key = MANEX_SERVICE_ROLE_KEY ?? MANEX_ANON_KEY;
      if (!MANEX_API_URL || !key) throw new Error("MANEX_API_URL and MANEX_ANON_KEY/SERVICE_ROLE_KEY required");
      const baseUrl = MANEX_API_URL.replace(/\/+$/, "");
      const client = new PostgrestClient(baseUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const res = await client.from("product").select("product_id").limit(1);
      if (res.error) {
        const diag = { message: res.error.message, code: res.error.code, details: res.error.details, hint: res.error.hint, status: res.status };
        throw new Error(`postgrest: ${JSON.stringify(diag)}`);
      }
      return `product rows reachable (${res.data?.length ?? 0} sample, first=${res.data?.[0]?.product_id ?? "n/a"})`;
    },
  },
  {
    name: "llm provider keys present",
    async run() {
      const missing: string[] = [];
      if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
      if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
      if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
      return "ANTHROPIC + OPENAI keys set";
    },
  },
];

async function main() {
  let failed = 0;
  for (const c of checks) {
    try {
      const msg = await c.run();
      console.log(`\u2713 ${c.name} \u2014 ${msg}`);
    } catch (err) {
      failed++;
      console.error(`\u2717 ${c.name} \u2014 ${(err as Error).message}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
