/**
 * scripts/embed-demo-lessons.ts
 *
 * M5b — Embed the 3 demo lessons that have NULL embeddings.
 *
 * For each row in lesson WHERE seed_source='demo' AND embedding IS NULL:
 *   - Compute embedding of signature_text via OpenAI text-embedding-3-small
 *   - UPDATE lesson SET embedding=<array> WHERE lesson_id=<id>
 *
 * Idempotent: skips lessons that already have embeddings.
 *
 * Usage:
 *   pnpm tsx scripts/embed-demo-lessons.ts
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
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

async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const [first] = response.data;
  if (!first?.embedding) {
    throw new Error("No embedding returned from OpenAI");
  }
  return first.embedding;
}

async function main() {
  const client = new Client({ connectionString: PG_URL });
  await client.connect();

  // Fetch demo lessons that need embeddings
  const { rows: lessons } = await client.query<{
    lesson_id: string;
    signature_text: string;
  }>(
    `SELECT lesson_id, signature_text
     FROM lesson
     WHERE seed_source = 'demo' AND embedding IS NULL
     ORDER BY lesson_id`,
  );

  if (lessons.length === 0) {
    console.log("All demo lessons already have embeddings. Nothing to do.");
    await client.end();
    return;
  }

  console.log(`Found ${lessons.length} demo lesson(s) without embeddings. Embedding now...`);

  for (const lesson of lessons) {
    console.log(`  Embedding ${lesson.lesson_id}: "${lesson.signature_text.slice(0, 80)}..."`);

    const embedding = await createEmbedding(lesson.signature_text);

    // Store as PostgreSQL array literal. pgvector / FLOAT8[] accepts array format.
    await client.query(
      `UPDATE lesson SET embedding = $1::float8[] WHERE lesson_id = $2`,
      [`{${embedding.join(",")}}`, lesson.lesson_id],
    );

    console.log(`  Done: ${lesson.lesson_id} — ${embedding.length} dims`);
  }

  // Verify
  const { rows: verified } = await client.query<{
    lesson_id: string;
    n: number | null;
  }>(
    `SELECT lesson_id, array_length(embedding, 1) AS n
     FROM lesson
     WHERE seed_source = 'demo'
     ORDER BY lesson_id`,
  );

  console.log("\nVerification:");
  for (const row of verified) {
    const ok = row.n === 1536 ? "OK" : "FAIL";
    console.log(`  ${row.lesson_id}: ${row.n ?? "NULL"} dims [${ok}]`);
  }

  const allOk = verified.every((r) => r.n === 1536);
  if (!allOk) {
    console.error("ERROR: not all demo lessons have 1536-dim embeddings");
    await client.end();
    process.exit(1);
  }

  console.log("\nAll demo lessons embedded successfully.");
  await client.end();
}

main().catch((err) => {
  console.error("embed-demo-lessons failed:", err);
  process.exit(1);
});
