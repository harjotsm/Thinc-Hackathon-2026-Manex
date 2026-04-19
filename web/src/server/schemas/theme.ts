import { z } from "zod";
import { archetypeEnum, incidentSeverityEnum } from "./incident";

export const themeIncidentSummarySchema = z.object({
  incident_id: z.string(),
  title: z.string().nullable().optional(),
  severity: incidentSeverityEnum.or(z.string()).nullable().optional(),
  last_activity_at: z.string().nullable().optional(),
  signal_count: z.number().int().optional().default(0),
});
export type ThemeIncidentSummary = z.infer<typeof themeIncidentSummarySchema>;

export const themeTitleSourceEnum = z.enum(["template", "llm", "fallback"]);

export const themeStatsSchema = z.object({
  n_incidents: z.number().int(),
  n_signals: z.number().int(),
  n_sources: z.number().int(),
  products: z.array(z.string()),
  lines: z.array(z.string()),
});

export const themeSchema = z.object({
  signature: z.string(),
  archetype: archetypeEnum,
  dominant_entity: z.string().nullable(),
  title: z.string(),
  title_source: themeTitleSourceEnum,
  incidents: z.array(themeIncidentSummarySchema),
  stats: themeStatsSchema,
  confidence_avg: z.number().min(0).max(1),
  severity_max: z.enum(["low", "medium", "high", "critical"]),
  last_seen: z.string(),
  related_signatures: z.array(z.string()),
  signal_buckets_7d: z.array(z.number().int()).length(7),
});
export type Theme = z.infer<typeof themeSchema>;

export const themeLensEnum = z.enum(["engineer", "floor", "leadership"]);

export const themesResponseSchema = z.object({
  themes: z.array(themeSchema),
  generated_at: z.string(),
  window_days: z.number().int(),
  lens: themeLensEnum,
});
export type ThemesResponse = z.infer<typeof themesResponseSchema>;
