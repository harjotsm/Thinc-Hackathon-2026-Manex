import type { Theme, ThemeIncidentSummary } from "@/server/schemas/theme";
import type { z } from "zod";
import { archetypeEnum } from "@/server/schemas/incident";

export type AggregatorIncidentInput = {
  incident_id: string;
  archetype: z.infer<typeof archetypeEnum>;
  primary_product_id: string | null;
  primary_part_number: string | null;
  title: string | null;
  severity: string | null;
  last_activity_at: string | null;
  signal_count: number;
  centroid_embedding: number[] | null;
  source_count: number;
};

const SEVERITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const SEVERITY_BY_RANK = ["low", "low", "medium", "high", "critical"] as const;

export const deriveDominantEntity = (i: AggregatorIncidentInput): string | null => {
  switch (i.archetype) {
    case "supplier":
    case "design":
      return i.primary_part_number ?? i.primary_product_id ?? null;
    case "drift":
    case "operator":
      return i.primary_product_id ?? null;
    case "unknown":
    default:
      return null;
  }
};

const signatureFor = (archetype: string, dominantEntity: string | null) =>
  `${archetype}:${dominantEntity ?? "—"}`;

const titleFor = (archetype: string, dominantEntity: string | null) => {
  const archLabel = archetype.charAt(0).toUpperCase() + archetype.slice(1);
  return dominantEntity ? `${archLabel} · ${dominantEntity}` : "Untriaged";
};

const bucket7d = (
  incidents: AggregatorIncidentInput[],
  now: Date,
): number[] => {
  const buckets = new Array(7).fill(0) as number[];
  const dayMs = 24 * 60 * 60 * 1000;
  // Bucket index 6 = today, 0 = 6 days ago
  for (const i of incidents) {
    if (!i.last_activity_at) continue;
    const t = new Date(i.last_activity_at).getTime();
    const ageDays = Math.floor((now.getTime() - t) / dayMs);
    if (ageDays < 0 || ageDays > 6) continue;
    buckets[6 - ageDays] += i.signal_count;
  }
  return buckets;
};

export type AggregateOptions = { now?: Date };

export const aggregateThemes = (
  incidents: AggregatorIncidentInput[],
  opts: AggregateOptions = {},
): Theme[] => {
  const now = opts.now ?? new Date();
  const groups = new Map<string, AggregatorIncidentInput[]>();
  for (const i of incidents) {
    const sig = signatureFor(i.archetype, deriveDominantEntity(i));
    const arr = groups.get(sig) ?? [];
    arr.push(i);
    groups.set(sig, arr);
  }

  const themes: Theme[] = [];
  for (const [sig, members] of groups) {
    const archetype = members[0].archetype;
    const dominant = deriveDominantEntity(members[0]);
    const summaries: ThemeIncidentSummary[] = members.map((m) => ({
      incident_id: m.incident_id,
      title: m.title,
      severity: m.severity,
      last_activity_at: m.last_activity_at,
      signal_count: m.signal_count,
    }));
    const products = Array.from(
      new Set(members.map((m) => m.primary_product_id).filter((v): v is string => v !== null)),
    );
    const nSignals = members.reduce((acc, m) => acc + m.signal_count, 0);
    const nSources = Math.max(...members.map((m) => m.source_count), 0);
    const severityRank = members.reduce(
      (acc, m) => Math.max(acc, SEVERITY_RANK[m.severity ?? "low"] ?? 1),
      1,
    );
    const lastSeen = members
      .map((m) => m.last_activity_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .reverse()[0] ?? new Date(0).toISOString();

    themes.push({
      signature: sig,
      archetype,
      dominant_entity: dominant,
      title: titleFor(archetype, dominant),
      title_source: archetype === "unknown" ? "fallback" : "template",
      incidents: summaries,
      stats: {
        n_incidents: members.length,
        n_signals: nSignals,
        n_sources: nSources,
        products,
        lines: [],
      },
      confidence_avg: 0, // populated by route (needs contributions data); 0 default
      severity_max: SEVERITY_BY_RANK[severityRank],
      last_seen: lastSeen,
      related_signatures: [],
      signal_buckets_7d: bucket7d(members, now),
    });
  }

  // Order: severity desc, then recency desc
  themes.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity_max] - SEVERITY_RANK[a.severity_max];
    if (sevDiff !== 0) return sevDiff;
    return b.last_seen.localeCompare(a.last_seen);
  });

  return themes;
};
