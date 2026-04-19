/**
 * Display-layer formatters used across Inbox, Incidents table and Canvas.
 * Keep pure + dependency-free so server and client can both use them.
 */

/** "INC-9F626BAFAB1E4B29A954" → "INC-9F62…A954". Stable across locale. */
export function shortId(id: string): string {
  if (!id) return id;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/**
 * Clean up machine-generated incident titles for display. The correlator
 * seeds titles like "Correlated incident: PRD-00027" (see correlator/run.ts).
 * We strip that prefix and surface a friendlier name. Hand-authored titles
 * pass through unchanged.
 */
export function prettifyIncidentTitle(
  title: string | null | undefined,
  fallbackId: string,
): string {
  const raw = (title ?? "").trim();
  if (!raw) return shortId(fallbackId);

  // Strip technical prefix "Correlated incident:"
  const stripped = raw.replace(/^Correlated incident:\s*/i, "");

  // If the remainder is just a part/product id (like "PRD-00027"), give it
  // a qualitative label so it reads as something, not just an id.
  if (/^(PRD|PM|SB|PO|MC)-\d{4,}$/i.test(stripped)) {
    return `Correlated cluster · ${stripped}`;
  }
  if (/^multi-source quality signal$/i.test(stripped)) {
    return "Multi-source quality signal";
  }
  return stripped;
}

/**
 * Hide the technical `INC-SEED-*` prefix that leaks from the seed dataset
 * without disturbing real hash ids. Used in chrome that shows raw incident
 * ids alongside titles (breadcrumbs, canvas header, evidence trail).
 */
export function displayIncidentId(id: string): string {
  if (!id) return id;
  if (id.startsWith("INC-SEED-")) {
    const tail = id.replace(/^INC-SEED-/, "");
    return `INC · ${tail}`;
  }
  return shortId(id);
}

/**
 * Archetype labels. Prefer hiding the "unknown" archetype entirely in UI
 * surfaces that render it as a badge; when a label is still needed, use
 * "Triage" so it reads as a state rather than a data gap.
 */
export function archetypeLabel(archetype: string | null | undefined): string {
  const a = (archetype ?? "").toLowerCase();
  if (!a || a === "unknown") return "Triage";
  return a;
}

export function isUnknownArchetype(archetype: string | null | undefined): boolean {
  const a = (archetype ?? "").toLowerCase();
  return !a || a === "unknown";
}
