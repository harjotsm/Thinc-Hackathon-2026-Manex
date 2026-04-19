"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InitiativeRow } from "@/server/schemas/initiative";

// ─── Column config ────────────────────────────────────────────────────────────

type ColumnId =
  | "draft"
  | "proposed"
  | "approved"
  | "dispatched"
  | "in_progress"
  | "blocked"
  | "verifying"
  | "done"
  | "closed"
  | "dismissed"
  | "failed"
  | "cancelled"
  | "reopen"
  | "rejected";

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "proposed", label: "Proposed" },
  { id: "approved", label: "Approved" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "verifying", label: "Verifying" },
  { id: "done", label: "Done" },
];

const SYSTEM_LABEL: Record<string, string> = {
  mes: "MES",
  srm: "SRM",
  jira: "JIRA",
  erp: "ERP",
  crm: "CRM",
  manex: "Manex",
};

const SYSTEM_COLOR: Record<string, { bg: string; fg: string }> = {
  MES: { bg: "#dbeafe", fg: "#1e40af" },
  SRM: { bg: "#fed7aa", fg: "#9a3412" },
  JIRA: { bg: "#ede9fe", fg: "#6d28d9" },
  ERP: { bg: "#d1fae5", fg: "#065f46" },
  CRM: { bg: "#fce7f3", fg: "#9d174d" },
  Manex: { bg: "#f1f5f9", fg: "#475569" },
};

const DOMAIN_TINT: Record<string, { bg: string; fg: string }> = {
  production: { bg: "#dbeafe", fg: "#1e40af" },
  supplier: { bg: "#fed7aa", fg: "#9a3412" },
  rnd: { bg: "#fce7f3", fg: "#9d174d" },
  logistics: { bg: "#d1fae5", fg: "#065f46" },
  customer_response: { bg: "#ede9fe", fg: "#6d28d9" },
};

function formatSystem(raw: string | null | undefined): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase().trim();
  for (const [k, v] of Object.entries(SYSTEM_LABEL)) {
    if (lower.includes(k)) return v;
  }
  return raw;
}

function formatDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "—";
  }
}

// Derive a human-readable title from whatever fields are available.
// The initiative table has no `comments` or `title` column directly —
// the description lives in the linked product_action.comments.
// We show: external_ref (PA-xxxxx) if present, else initiative_id.
function initiativeLabel(row: InitiativeRow): string {
  const ref = (row as Record<string, unknown>).external_ref as string | null | undefined;
  if (ref) return ref;
  return row.initiative_id;
}

// Try created_ts (real DB column), fall back to created_at (schema field).
function initiativeCreatedTs(row: InitiativeRow): string | null | undefined {
  const ts = (row as Record<string, unknown>).created_ts as string | null | undefined;
  if (ts) return ts;
  return row.created_at;
}

// ─── Refresh island (client) ──────────────────────────────────────────────────

function RefreshButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      style={{
        background: "none",
        border: "1px solid var(--line, #e2e8f0)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 11,
        color: "var(--ink-muted, #64748b)",
        cursor: "pointer",
        fontWeight: 500,
      }}
    >
      Refresh
    </button>
  );
}

// ─── Initiative card ──────────────────────────────────────────────────────────

function InitiativeCard({ initiative }: { initiative: InitiativeRow }) {
  const sys = formatSystem(initiative.target_system);
  const sysColor = SYSTEM_COLOR[sys] ?? { bg: "#f1f5f9", fg: "#475569" };
  const domainTint =
    DOMAIN_TINT[initiative.agent_domain] ?? DOMAIN_TINT.production;

  return (
    <div
      data-testid={`kanban-card-${initiative.initiative_id}`}
      style={{
        padding: "10px 12px",
        marginBottom: 8,
        background: "var(--bg-surface, white)",
        border: "1px solid var(--line, #e2e8f0)",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        gap: 7,
      }}
    >
      {/* Top row: initiative_id + incident link */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "var(--ink-muted, #94a3b8)",
            fontWeight: 500,
            textTransform: "uppercase",
          }}
        >
          {initiative.initiative_id}
        </span>
        {initiative.incident_id && (
          <Link
            href={`/incident/${encodeURIComponent(initiative.incident_id)}`}
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "var(--accent, #639fc4)",
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            &larr; {initiative.incident_id}
          </Link>
        )}
      </div>

      {/* Label / description */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          lineHeight: 1.4,
          color: "var(--ink-primary, #0f172a)",
          overflowWrap: "anywhere",
        }}
      >
        {initiative.agent_domain} → {formatSystem(initiative.target_system)}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "var(--ink-muted, #94a3b8)",
        }}
      >
        {initiativeLabel(initiative)}
      </div>

      {/* Pills row: system + domain */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            background: sysColor.bg,
            color: sysColor.fg,
            padding: "2px 6px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {sys}
        </span>
        <span
          style={{
            background: domainTint.bg,
            color: domainTint.fg,
            padding: "2px 6px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {initiative.agent_domain}
        </span>
      </div>

      {/* Footer: owner + date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--ink-muted, #94a3b8)",
          marginTop: 2,
        }}
      >
        <span>
          {initiative.owner_user_id ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--bg-inset, #f1f5f9)",
                fontSize: 8,
                fontWeight: 700,
                color: "var(--ink-secondary, #475569)",
              }}
            >
              {initiative.owner_user_id.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <span style={{ color: "var(--ink-muted, #94a3b8)" }}>unassigned</span>
          )}
        </span>
        <span style={{ fontFamily: "monospace" }}>
          {formatDate(initiativeCreatedTs(initiative))}
        </span>
      </div>
    </div>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

type Props = {
  initiatives: InitiativeRow[];
};

export function InitiativesKanban({ initiatives }: Props) {
  // Group by status; statuses not in COLUMNS are shown in the closest matching column
  const byStatus = new Map<string, InitiativeRow[]>();
  for (const col of COLUMNS) {
    byStatus.set(col.id, []);
  }
  for (const init of initiatives) {
    const status = init.status as string;
    if (byStatus.has(status)) {
      byStatus.get(status)!.push(init);
    } else {
      // Bucket unknown statuses into "proposed"
      byStatus.get("proposed")!.push(init);
    }
  }

  return (
    <div data-testid="initiatives-kanban">
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "10px 24px 4px",
        }}
      >
        <RefreshButton />
      </div>

      {/* Board */}
      <div
        style={{
          padding: "8px 16px 24px",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(230px, 1fr))`,
            gap: 10,
            minWidth: 0,
          }}
        >
          {COLUMNS.map((col) => {
            const cards = byStatus.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                data-testid={`kanban-col-${col.id}`}
                style={{ display: "flex", flexDirection: "column" }}
              >
                {/* Column header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color:
                        col.id === "proposed"
                          ? "var(--accent, #639fc4)"
                          : "var(--ink-muted, #64748b)",
                    }}
                  >
                    {col.label}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      background: "var(--bg-inset, #f1f5f9)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--ink-secondary, #475569)",
                      padding: "0 4px",
                    }}
                  >
                    {cards.length}
                  </span>
                </div>

                {/* Column body */}
                <div
                  style={{
                    flex: 1,
                    background: "var(--bg-subtle, #f8fafc)",
                    borderRadius: 8,
                    padding: 8,
                    border: "1px solid var(--line, #e2e8f0)",
                    minHeight: 80,
                  }}
                >
                  {cards.length === 0 ? (
                    <p
                      style={{
                        margin: 0,
                        padding: "12px 6px",
                        fontSize: 11,
                        color: "var(--ink-muted, #94a3b8)",
                        textAlign: "center",
                      }}
                    >
                      No initiatives in this status.
                    </p>
                  ) : (
                    cards.map((init) => (
                      <InitiativeCard
                        key={init.initiative_id}
                        initiative={init}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
