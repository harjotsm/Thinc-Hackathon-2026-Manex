/**
 * backfill-incident-archetype.mjs
 *
 * One-shot script: reads the latest report per incident, extracts
 * report_8d._archetype, and writes it back to incident.archetype.
 *
 * Run from the web/ directory:
 *   node scripts/backfill-incident-archetype.mjs
 */

import { PostgrestClient } from "@supabase/postgrest-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Load .env.local manually (no dotenv dep needed) ─────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

let envRaw = "";
try {
  envRaw = readFileSync(envPath, "utf-8");
} catch {
  // fall back to process.env
}

/** @type {Record<string,string>} */
const envOverrides = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx <= 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  envOverrides[key] = value;
}

const get = (name) =>
  envOverrides[name] ?? process.env[name] ?? "";

const MANEX_API_URL = get("MANEX_API_URL") || get("NEXT_PUBLIC_MANEX_API_URL");
const SERVICE_KEY =
  get("MANEX_SERVICE_ROLE_KEY") ||
  get("MANEX_ANON_KEY") ||
  get("NEXT_PUBLIC_MANEX_ANON_KEY");

if (!MANEX_API_URL || !SERVICE_KEY) {
  console.error(
    "ERROR: MANEX_API_URL and MANEX_SERVICE_ROLE_KEY must be set (checked .env.local and process.env)."
  );
  process.exit(1);
}

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabase = new PostgrestClient(MANEX_API_URL, {
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  },
});

// ─── Valid archetypes ─────────────────────────────────────────────────────────

const VALID_ARCHETYPE = new Set(["supplier", "drift", "design", "operator", "unknown"]);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to", MANEX_API_URL);

  // 1. Fetch all report rows ordered by version desc
  const { data: reports, error: reportErr } = await supabase
    .from("report")
    .select("incident_id,version,report_8d")
    .order("version", { ascending: false });

  if (reportErr) {
    console.error("Failed to fetch reports:", reportErr.message);
    process.exit(1);
  }

  if (!reports || reports.length === 0) {
    console.log("No report rows found. Nothing to backfill.");
    return;
  }

  // 2. Pick the latest (highest version) per incident_id
  /** @type {Map<string, string>} incidentId → archetype */
  const latestArchetype = new Map();

  for (const row of reports) {
    const incId = row.incident_id;
    if (!incId) continue;
    if (latestArchetype.has(incId)) continue; // already have the latest (ordered desc)

    const raw8d = row.report_8d ?? {};
    const arch = typeof raw8d._archetype === "string" ? raw8d._archetype : null;
    if (arch && VALID_ARCHETYPE.has(arch)) {
      latestArchetype.set(incId, arch);
    }
  }

  console.log(
    `Found ${reports.length} report rows covering ${latestArchetype.size} incidents with a valid archetype.`
  );

  if (latestArchetype.size === 0) {
    console.log("No valid archetypes found in report_8d._archetype. Nothing to backfill.");
    return;
  }

  // 3. Fetch current incident.archetype values to skip unchanged rows
  const incidentIds = [...latestArchetype.keys()];

  const { data: incidentRows, error: incErr } = await supabase
    .from("incident")
    .select("incident_id,archetype")
    .in("incident_id", incidentIds);

  if (incErr) {
    console.error("Failed to fetch incidents:", incErr.message);
    process.exit(1);
  }

  /** @type {Map<string, string|null>} */
  const currentArchetype = new Map(
    (incidentRows ?? []).map((r) => [r.incident_id, r.archetype ?? null])
  );

  // 4. Collect rows that need updating
  const toUpdate = incidentIds.filter((id) => {
    const derived = latestArchetype.get(id);
    const current = currentArchetype.get(id);
    return derived !== null && derived !== current;
  });

  console.log(`${toUpdate.length} of ${incidentIds.length} incidents need archetype backfill.`);

  if (toUpdate.length === 0) {
    console.log("All incidents already up to date. Done.");
    return;
  }

  // 5. Update each row (PostgREST supports batch filter; do them individually
  //    to get per-row error visibility without depending on upsert)
  let updated = 0;
  let failed = 0;

  for (const incidentId of toUpdate) {
    const archetype = latestArchetype.get(incidentId);
    const { error: updateErr } = await supabase
      .from("incident")
      .update({ archetype })
      .eq("incident_id", incidentId);

    if (updateErr) {
      console.warn(`  FAILED ${incidentId}: ${updateErr.message}`);
      failed++;
    } else {
      console.log(`  Updated ${incidentId} → ${archetype}`);
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
