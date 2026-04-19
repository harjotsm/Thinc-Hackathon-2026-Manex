/**
 * scripts/backfill-signals.ts
 *
 * M5a — One-shot backfill: ingests the most-recent rows from defect,
 * field_claim, and test_result (MARGINAL/FAIL only) into the resolve
 * `signal` table, then groups signals into demo incidents.
 *
 * SIMPLIFIED CORRELATOR (demo-only)
 * -----------------------------------
 * The production correlator lives in web/src/server/correlator/ and cannot
 * be imported here (server-only guard). This script replicates a subset of
 * its logic inline:
 *   1. Primary grouping: `reported_part_number` alone for parts in
 *      CROSS_PRODUCT_PARTS (the cross-product supplier / design-drift stories).
 *   2. Secondary grouping: `(product_id, reported_part_number)` for per-product
 *      clusters not absorbed by the part-level pass.
 *   Groups with <3 signals remain `pending_cluster`; >=3 become incidents.
 *   Real Classify phase will re-classify archetypes from 'unknown'.
 *
 * Usage:
 *   pnpm backfill:seed
 *   (or)  pnpm tsx scripts/backfill-signals.ts
 *
 * Idempotent: re-runs skip signals whose idempotency_key already exists.
 * Watermark: tracks last-seen ts per source table in backfill_watermark.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { Client } from "pg";
import OpenAI from "openai";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const PG_URL = process.env.MANEX_PG_URL;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!PG_URL || !OPENAI_KEY) {
  console.error("MANEX_PG_URL and OPENAI_API_KEY required");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

const LIMIT_PER_TABLE = 500;
const EMBED_BATCH_SIZE = 100;
const MIN_GROUP_SIZE_FOR_INCIDENT = 3;

// Parts clustered cross-product (key demo stories):
// PM-00008 = 100uF ElektroParts cap (Story 1: supplier batch)
// PM-00015 = R33 thermal-drift resistor (Story 3: design drift)
const CROSS_PRODUCT_PARTS = new Set(["PM-00008", "PM-00015"]);

// ── Types ──────────────────────────────────────────────────────────────────

type SeverityLevel = "low" | "medium" | "high" | "critical";

interface SignalRow {
  signal_id: string;
  source: "backfill_defect" | "backfill_field_claim" | "backfill_test_result";
  source_system: string;
  source_ref: string;
  captured_ts: string;
  raw_text: string;
  raw_payload: Record<string, unknown>;
  lang: "de" | "en";
  product_id: string | null;
  reported_part_number: string | null;
  section_id: string | null;
  defect_code: string | null;
  test_key: string | null;
  market: string | null;
  severity: SeverityLevel;
  severity_hint: number;
  idempotency_key: string;
  signal_type: "factory_defect" | "field_claim" | "marginal_test";
}

interface SignalGroupInfo {
  signalIds: string[];
  productIds: Set<string>;
  partNumber: string;
  productId: string | null; // null = cross-product cluster
  severities: SeverityLevel[];
  defectCodes: string[];
  earliestTs: string;
  latestTs: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function idempotencyKey(source: string, ref: string): string {
  return createHash("sha256").update(`${source}:${ref}`).digest("hex");
}

function nanoid8(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function severityFromText(raw: string | null): SeverityLevel {
  if (!raw) return "medium";
  const s = raw.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high" || s === "major") return "high";
  if (s === "low" || s === "minor") return "low";
  return "medium";
}

function severityFromCost(cost: number | null): SeverityLevel {
  if (!cost) return "medium";
  if (cost > 5000) return "high";
  if (cost > 1000) return "medium";
  return "low";
}

function severityToHint(s: SeverityLevel): number {
  const map: Record<SeverityLevel, number> = {
    low: 0.2,
    medium: 0.5,
    high: 0.75,
    critical: 1.0,
  };
  return map[s];
}

function maxSeverity(severities: SeverityLevel[]): SeverityLevel {
  const order: SeverityLevel[] = ["low", "medium", "high", "critical"];
  let max: SeverityLevel = "low";
  for (const s of severities) {
    if (order.indexOf(s) > order.indexOf(max)) max = s;
  }
  return max;
}

function detectLang(text: string): "de" | "en" {
  return /\b(der|die|das|und|ich|wir|für|ist|bei|von|mit|nach|auf|sich|des|dem|ein|eine|nicht|oder|aber)\b/i.test(
    text
  )
    ? "de"
    : "en";
}

// ── Fetch rows ─────────────────────────────────────────────────────────────

async function fetchDefects(db: Client): Promise<SignalRow[]> {
  const { rows } = await db.query(
    `SELECT defect_id, product_id, ts, defect_code, severity,
            detected_section_id, reported_part_number, cost, notes
     FROM defect
     ORDER BY ts DESC NULLS LAST
     LIMIT $1`,
    [LIMIT_PER_TABLE]
  );

  return rows.map((r) => {
    const sev = severityFromText(r.severity);
    const rawText = [
      `Factory defect on ${r.product_id} — ${r.defect_code ?? "unknown"} (${sev}).`,
      r.reported_part_number ? `Part ${r.reported_part_number}.` : "",
      r.notes ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return {
      signal_id: `SIG-D-${r.defect_id}`,
      source: "backfill_defect" as const,
      source_system: "manex_defect",
      source_ref: r.defect_id,
      captured_ts:
        r.ts instanceof Date
          ? r.ts.toISOString()
          : (r.ts ?? new Date().toISOString()),
      raw_text: rawText,
      raw_payload: r as Record<string, unknown>,
      lang: "en" as const,
      product_id: r.product_id ?? null,
      reported_part_number: r.reported_part_number ?? null,
      section_id: r.detected_section_id ?? null,
      defect_code: r.defect_code ?? null,
      test_key: null,
      market: null,
      severity: sev,
      severity_hint: severityToHint(sev),
      idempotency_key: idempotencyKey("backfill_defect", r.defect_id),
      signal_type: "factory_defect" as const,
    };
  });
}

async function fetchFieldClaims(db: Client): Promise<SignalRow[]> {
  const { rows } = await db.query(
    `SELECT field_claim_id, product_id, claim_ts, market,
            complaint_text, reported_part_number, cost, detected_section_id, notes
     FROM field_claim
     ORDER BY claim_ts DESC NULLS LAST
     LIMIT $1`,
    [LIMIT_PER_TABLE]
  );

  return rows.map((r) => {
    const rawText = (r.complaint_text ?? r.notes ?? "Field claim").trim();
    const sev = severityFromCost(r.cost !== null ? parseFloat(r.cost) : null);

    return {
      signal_id: `SIG-FC-${r.field_claim_id}`,
      source: "backfill_field_claim" as const,
      source_system: "manex_field_claim",
      source_ref: r.field_claim_id,
      captured_ts:
        r.claim_ts instanceof Date
          ? r.claim_ts.toISOString()
          : (r.claim_ts ?? new Date().toISOString()),
      raw_text: rawText,
      raw_payload: r as Record<string, unknown>,
      lang: detectLang(rawText),
      product_id: r.product_id ?? null,
      reported_part_number: r.reported_part_number ?? null,
      section_id: r.detected_section_id ?? null,
      defect_code: null,
      test_key: null,
      market: r.market ?? null,
      severity: sev,
      severity_hint: severityToHint(sev),
      idempotency_key: idempotencyKey("backfill_field_claim", r.field_claim_id),
      signal_type: "field_claim" as const,
    };
  });
}

async function fetchTestResults(db: Client): Promise<SignalRow[]> {
  const { rows } = await db.query(
    `SELECT test_result_id, product_id, section_id, ts,
            overall_result, test_key, test_value, unit, notes
     FROM test_result
     WHERE overall_result IN ('MARGINAL','FAIL')
     ORDER BY ts DESC NULLS LAST
     LIMIT $1`,
    [LIMIT_PER_TABLE]
  );

  return rows.map((r) => {
    const rawText = [
      `${r.overall_result} test '${r.test_key ?? "unknown"}' on ${r.product_id}`,
      r.test_value != null ? `measured ${r.test_value}${r.unit ?? ""}` : "",
      `Section: ${r.section_id ?? "unknown"}.`,
      r.notes ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const sev: SeverityLevel =
      r.overall_result === "FAIL" ? "high" : "medium";

    return {
      signal_id: `SIG-T-${r.test_result_id}`,
      source: "backfill_test_result" as const,
      source_system: "manex_test_result",
      source_ref: r.test_result_id,
      captured_ts:
        r.ts instanceof Date
          ? r.ts.toISOString()
          : (r.ts ?? new Date().toISOString()),
      raw_text: rawText,
      raw_payload: r as Record<string, unknown>,
      lang: "en" as const,
      product_id: r.product_id ?? null,
      reported_part_number: null,
      section_id: r.section_id ?? null,
      defect_code: null,
      test_key: r.test_key ?? null,
      market: null,
      severity: sev,
      severity_hint: severityToHint(sev),
      idempotency_key: idempotencyKey(
        "backfill_test_result",
        r.test_result_id
      ),
      signal_type: "marginal_test" as const,
    };
  });
}

// ── Embedding ──────────────────────────────────────────────────────────────

async function embedBatch(texts: string[]): Promise<number[][]> {
  const resp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return resp.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// ── Insert signals ─────────────────────────────────────────────────────────

async function insertSignals(
  db: Client,
  signals: (SignalRow & { embedding: number[] })[]
): Promise<number> {
  if (signals.length === 0) return 0;

  let inserted = 0;
  for (const s of signals) {
    try {
      const result = await db.query(
        `INSERT INTO signal (
           signal_id, source, source_system, source_ref, captured_ts,
           raw_text, raw_payload, lang, product_id, reported_part_number,
           section_id, defect_code, test_key, market, severity, severity_hint,
           idempotency_key, signal_type, embedding, cluster_state
         ) VALUES (
           $1,$2::signal_source,$3,$4,$5,
           $6,$7::jsonb,$8::lang_t,$9,$10,
           $11,$12,$13,$14,$15::severity_t,$16,
           $17,$18::signal_type_new,$19::float8[],'pending_cluster'::cluster_state_t
         )
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          s.signal_id,
          s.source,
          s.source_system,
          s.source_ref,
          s.captured_ts,
          s.raw_text,
          JSON.stringify(s.raw_payload),
          s.lang,
          s.product_id,
          s.reported_part_number,
          s.section_id,
          s.defect_code,
          s.test_key,
          s.market,
          s.severity,
          s.severity_hint,
          s.idempotency_key,
          s.signal_type,
          `{${s.embedding.join(",")}}`,
        ]
      );
      if ((result.rowCount ?? 0) > 0) inserted++;
    } catch (err) {
      console.warn(
        `  WARN: skipped signal ${s.signal_id}: ${(err as Error).message}`
      );
    }
  }
  return inserted;
}

// ── Incident clustering ────────────────────────────────────────────────────

/**
 * Two-pass clustering:
 * Pass 1: Group by reported_part_number alone for CROSS_PRODUCT_PARTS.
 * Pass 2: For remaining signals, group by (product_id, reported_part_number).
 */
function buildGroups(signals: SignalRow[]): Map<string, SignalGroupInfo> {
  const groups = new Map<string, SignalGroupInfo>();

  function addToGroup(
    key: string,
    s: SignalRow,
    partNumber: string,
    productId: string | null
  ): void {
    if (!groups.has(key)) {
      groups.set(key, {
        signalIds: [],
        productIds: new Set(),
        partNumber,
        productId,
        severities: [],
        defectCodes: [],
        earliestTs: s.captured_ts,
        latestTs: s.captured_ts,
      });
    }
    const g = groups.get(key)!;
    g.signalIds.push(s.signal_id);
    if (s.product_id) g.productIds.add(s.product_id);
    g.severities.push(s.severity);
    if (s.defect_code) g.defectCodes.push(s.defect_code);
    if (s.captured_ts < g.earliestTs) g.earliestTs = s.captured_ts;
    if (s.captured_ts > g.latestTs) g.latestTs = s.captured_ts;
  }

  const claimedIds = new Set<string>();

  // Pass 1: cross-product parts — cluster by part number only
  for (const s of signals) {
    if (
      s.reported_part_number &&
      CROSS_PRODUCT_PARTS.has(s.reported_part_number)
    ) {
      addToGroup(`part:${s.reported_part_number}`, s, s.reported_part_number, null);
      claimedIds.add(s.signal_id);
    }
  }

  // Pass 2: per-product pairs for unclaimed signals
  for (const s of signals) {
    if (claimedIds.has(s.signal_id)) continue;
    if (!s.product_id || !s.reported_part_number) continue;
    addToGroup(
      `prod-part:${s.product_id}:${s.reported_part_number}`,
      s,
      s.reported_part_number,
      s.product_id
    );
  }

  return groups;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const db = new Client({ connectionString: PG_URL });
  await db.connect();

  try {
    // 1. Fetch source rows ──────────────────────────────────────────────────

    process.stdout.write(`fetching defect (limit ${LIMIT_PER_TABLE})... `);
    const defectSignals = await fetchDefects(db);
    console.log(`${defectSignals.length} rows`);

    process.stdout.write(`fetching field_claim (limit ${LIMIT_PER_TABLE})... `);
    const claimSignals = await fetchFieldClaims(db);
    console.log(`${claimSignals.length} rows`);

    process.stdout.write(
      `fetching test_result (marginal/fail, limit ${LIMIT_PER_TABLE})... `
    );
    const testSignals = await fetchTestResults(db);
    console.log(`${testSignals.length} rows`);

    const allSignals = [...defectSignals, ...claimSignals, ...testSignals];
    console.log(`total candidate signals: ${allSignals.length}`);

    // 2. Skip already-ingested signals ─────────────────────────────────────

    const existingKeys = new Set<string>();
    const allKeys = allSignals.map((s) => s.idempotency_key);

    for (let i = 0; i < allKeys.length; i += 500) {
      const chunk = allKeys.slice(i, i + 500);
      const placeholders = chunk.map((_, j) => `$${j + 1}`).join(",");
      const { rows } = await db.query(
        `SELECT idempotency_key FROM signal WHERE idempotency_key IN (${placeholders})`,
        chunk
      );
      rows.forEach((r) => existingKeys.add(r.idempotency_key));
    }

    const newSignals = allSignals.filter(
      (s) => !existingKeys.has(s.idempotency_key)
    );
    const skipped = allSignals.length - newSignals.length;
    console.log(
      `new signals to insert: ${newSignals.length} (skipped ${skipped} already ingested)`
    );

    // 3. Embed in batches ───────────────────────────────────────────────────

    const embeddedSignals: (SignalRow & { embedding: number[] })[] = [];

    if (newSignals.length > 0) {
      const totalBatches = Math.ceil(newSignals.length / EMBED_BATCH_SIZE);
      for (let i = 0; i < newSignals.length; i += EMBED_BATCH_SIZE) {
        const batch = newSignals.slice(i, i + EMBED_BATCH_SIZE);
        const batchNum = Math.floor(i / EMBED_BATCH_SIZE) + 1;
        process.stdout.write(
          `embedding batch ${batchNum}/${totalBatches} (${batch.length} texts)... `
        );
        const embeddings = await embedBatch(batch.map((s) => s.raw_text));
        console.log("done");
        for (let j = 0; j < batch.length; j++) {
          embeddedSignals.push({ ...batch[j], embedding: embeddings[j] });
        }
      }
    }

    // 4. Insert signals ─────────────────────────────────────────────────────

    const insertedCount = await insertSignals(db, embeddedSignals);
    console.log(
      `inserted ${insertedCount} new signals (skipped ${skipped} already ingested)`
    );

    // 5. Build groups from ALL backfill signals in DB ───────────────────────
    // Re-fetch ensures complete grouping even on re-run.

    console.log(`grouping by (product_id, reported_part_number)...`);

    const { rows: dbSignals } = await db.query(
      `SELECT signal_id, product_id, reported_part_number, defect_code,
              severity, captured_ts
       FROM signal
       WHERE source IN ('backfill_defect','backfill_field_claim','backfill_test_result')
         AND reported_part_number IS NOT NULL`
    );

    const dbSignalRows: SignalRow[] = dbSignals.map((r) => ({
      signal_id: r.signal_id,
      source: r.source as SignalRow["source"],
      source_system: "",
      source_ref: "",
      captured_ts:
        r.captured_ts instanceof Date
          ? r.captured_ts.toISOString()
          : (r.captured_ts ?? new Date().toISOString()),
      raw_text: "",
      raw_payload: {},
      lang: "en" as const,
      product_id: r.product_id ?? null,
      reported_part_number: r.reported_part_number ?? null,
      section_id: null,
      defect_code: r.defect_code ?? null,
      test_key: null,
      market: null,
      severity: (r.severity ?? "medium") as SeverityLevel,
      severity_hint: 0.5,
      idempotency_key: "",
      signal_type: "factory_defect" as const,
    }));

    const groups = buildGroups(dbSignalRows);

    // 6. Create incidents for groups >= MIN_GROUP_SIZE_FOR_INCIDENT ─────────

    let incidentsCreated = 0;
    let incidentsUpdated = 0;
    let signalsAttached = 0;
    let contributionsSeeded = 0;

    // Load existing incidents keyed by signature_text (idempotency)
    const { rows: existingIncidentRows } = await db.query(
      `SELECT incident_id, signature_text FROM incident WHERE signature_text IS NOT NULL`
    );
    const existingIncidentSigs = new Map<string, string>(
      existingIncidentRows.map((r) => [r.signature_text as string, r.incident_id as string])
    );

    for (const [groupKey, group] of groups.entries()) {
      if (group.signalIds.length < MIN_GROUP_SIZE_FOR_INCIDENT) continue;

      // Top defect code by frequency
      const topDefectCode =
        group.defectCodes.length > 0
          ? Object.entries(
              group.defectCodes.reduce(
                (acc: Record<string, number>, c) => {
                  acc[c] = (acc[c] ?? 0) + 1;
                  return acc;
                },
                {}
              )
            ).sort((a, b) => b[1] - a[1])[0][0]
          : null;

      const isCrossProduct = groupKey.startsWith("part:");
      const signatureText = isCrossProduct
        ? `part:${group.partNumber}:cross-product`
        : `prod-part:${group.productId}:${group.partNumber}`;

      let incidentId = existingIncidentSigs.get(signatureText);
      const isNew = !incidentId;

      if (!incidentId) {
        incidentId = `INC-BF-${nanoid8()}`;

        const productList = Array.from(group.productIds);
        const primaryProductId =
          !isCrossProduct && group.productId ? group.productId : null;

        const incTitle = isCrossProduct
          ? `Quality cluster: ${group.partNumber} (multi-product)`
          : `Quality cluster: ${group.partNumber} on ${group.productId}`;

        const incSummary = topDefectCode
          ? `${group.signalIds.length} signals matched on part ${group.partNumber}. Most common defect: ${topDefectCode}.`
          : `${group.signalIds.length} signals matched on part ${group.partNumber}.`;

        const incSeverity = maxSeverity(group.severities);

        await db.query(
          `INSERT INTO incident (
             incident_id, status, archetype, title, summary, severity,
             primary_product_id, primary_part, signal_count,
             opened_ts, last_activity_at, is_provisional,
             linked_product_ids, signature_text
           ) VALUES (
             $1,'triage'::incident_status_t,'unknown'::archetype_t,$2,$3,$4,
             $5,$6,$7,$8,$9,false,$10::text[],$11
           )`,
          [
            incidentId,
            incTitle,
            incSummary,
            incSeverity,
            primaryProductId,
            group.partNumber,
            group.signalIds.length,
            group.earliestTs,
            group.latestTs,
            productList,
            signatureText,
          ]
        );
        incidentsCreated++;

        // Seed 9 stub contributions
        await db.query(`SELECT seed_contribution_domains($1)`, [incidentId]);
        contributionsSeeded += 9;

        existingIncidentSigs.set(signatureText, incidentId);
      } else {
        // Update signal_count on existing incident
        await db.query(
          `UPDATE incident
           SET signal_count     = $1,
               last_activity_at = $2
           WHERE incident_id = $3`,
          [group.signalIds.length, group.latestTs, incidentId]
        );
        incidentsUpdated++;
      }

      // Attach all signals in this group to the incident
      // Use individual updates to avoid parameter limit issues with large groups
      for (const sigId of group.signalIds) {
        await db.query(
          `UPDATE signal
           SET incident_id         = $1,
               matched_incident_id = $1,
               cluster_state       = 'attached'::cluster_state_t,
               match_type          = 'det_prod_def'::match_type_t,
               match_score         = 1.0,
               attach_reason       = 'bulk backfill deterministic group by (product_id, reported_part_number)'
           WHERE signal_id = $2`,
          [incidentId, sigId]
        );
      }
      signalsAttached += group.signalIds.length;
    }

    // 7. Update backfill watermark ─────────────────────────────────────────

    const watermarks = [
      {
        table: "defect",
        ts: defectSignals[0]?.captured_ts ?? null,
        id: defectSignals[0]?.source_ref ?? null,
      },
      {
        table: "field_claim",
        ts: claimSignals[0]?.captured_ts ?? null,
        id: claimSignals[0]?.source_ref ?? null,
      },
      {
        table: "test_result",
        ts: testSignals[0]?.captured_ts ?? null,
        id: testSignals[0]?.source_ref ?? null,
      },
    ];

    for (const wm of watermarks) {
      if (!wm.ts) continue;
      await db.query(
        `INSERT INTO backfill_watermark (source_table, last_seen_ts, last_id, updated_at)
         VALUES ($1,$2,$3,now())
         ON CONFLICT (source_table) DO UPDATE
           SET last_seen_ts = EXCLUDED.last_seen_ts,
               last_id      = EXCLUDED.last_id,
               updated_at   = now()`,
        [wm.table, wm.ts, wm.id]
      );
    }

    // 8. Summary ───────────────────────────────────────────────────────────

    const { rows: pendingRows } = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM signal WHERE cluster_state = 'pending_cluster'`
    );
    const { rows: attachedRows } = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM signal WHERE cluster_state = 'attached'`
    );

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `\ncreated ${incidentsCreated} incidents (groups >= ${MIN_GROUP_SIZE_FOR_INCIDENT})`
    );
    if (incidentsUpdated > 0) {
      console.log(`updated ${incidentsUpdated} existing incidents (signal_count refresh)`);
    }
    console.log(
      `attached ${attachedRows[0].cnt} signals to incidents; ${pendingRows[0].cnt} remain pending_cluster`
    );
    console.log(
      `seeded ${contributionsSeeded} stub contributions (9 per incident x ${incidentsCreated} new incidents)`
    );
    console.log(`backfill complete. runtime: ${elapsed}s`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
