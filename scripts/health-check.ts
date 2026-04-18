import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

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
    name: "PostgREST via supabase-js",
    async run() {
      if (!MANEX_API_URL || !(MANEX_SERVICE_ROLE_KEY ?? MANEX_ANON_KEY))
        throw new Error("MANEX_API_URL and MANEX_ANON_KEY/SERVICE_ROLE_KEY required");
      const sb = createClient(MANEX_API_URL, (MANEX_SERVICE_ROLE_KEY ?? MANEX_ANON_KEY)!, { auth: { persistSession: false } });
      const { data, error } = await sb.from("product").select("product_id").limit(1);
      if (error) throw new Error(`postgrest: ${error.message}`);
      return `product rows reachable (${data?.length ?? 0} sample)`;
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

let failed = 0;
for (const c of checks) {
  try {
    const msg = await c.run();
    console.log(`\u2713 ${c.name} — ${msg}`);
  } catch (err) {
    failed++;
    console.error(`\u2717 ${c.name} — ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
