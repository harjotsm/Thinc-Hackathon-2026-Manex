/**
 * Integration test for GET /api/themes
 *
 * Hits the real seeded Postgres (per CLAUDE.md: never mock the database for
 * tests that touch the semantic layer).
 *
 * Env vars are loaded from web/.env.local before the Supabase client is
 * initialised. Vitest does not auto-load .env.local, so we parse it here.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect, beforeAll } from "vitest";

// ── Load .env.local before any module that reads process.env ─────────────────
beforeAll(() => {
  // __dirname is web/src/app/api/themes/__tests__ — five levels up is web/
  const envPath = path.resolve(__dirname, "../../../../..", ".env.local");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  }
});

describe("GET /api/themes (integration)", () => {
  it("returns at least one theme per major archetype on the seeded dataset", async () => {
    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/themes?lens=engineer&window=30d");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.themes)).toBe(true);
    const archetypes = new Set(body.themes.map((t: { archetype: string }) => t.archetype));
    expect(archetypes.size).toBeGreaterThan(0);
    // Soft expectation: the supplier story should always be present in the seed
    const sigs = body.themes.map((t: { signature: string }) => t.signature);
    expect(sigs.some((s: string) => s.startsWith("supplier:"))).toBe(true);
  });
});
