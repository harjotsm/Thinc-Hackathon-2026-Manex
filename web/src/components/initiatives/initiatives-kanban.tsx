"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import type { InitiativeRow } from "@/server/schemas/initiative";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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

const COLUMNS: { id: ColumnId; label: string; tint?: string }[] = [
  { id: "proposed",    label: "Proposed",    tint: "text-primary" },
  { id: "approved",    label: "Approved",    tint: "text-blue-700" },
  { id: "in_progress", label: "In Progress", tint: "text-amber-700" },
  { id: "blocked",     label: "Blocked",     tint: "text-orange-700" },
  { id: "verifying",   label: "Verifying",   tint: "text-violet-700" },
  { id: "done",        label: "Done",        tint: "text-emerald-700" },
];

const SYSTEM_LABEL: Record<string, string> = {
  mes: "MES",
  srm: "SRM",
  jira: "JIRA",
  erp: "ERP",
  crm: "CRM",
  manex: "Manex",
};

const SYSTEM_BADGE: Record<string, string> = {
  MES:   "bg-blue-100 text-blue-800 border-blue-200",
  SRM:   "bg-orange-100 text-orange-800 border-orange-200",
  JIRA:  "bg-violet-100 text-violet-800 border-violet-200",
  ERP:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  CRM:   "bg-pink-100 text-pink-800 border-pink-200",
  Manex: "bg-zinc-100 text-zinc-700 border-zinc-200",
};

const DOMAIN_BADGE: Record<string, string> = {
  production:        "bg-blue-100 text-blue-800 border-blue-200",
  supplier:          "bg-orange-100 text-orange-800 border-orange-200",
  rnd:               "bg-pink-100 text-pink-800 border-pink-200",
  logistics:         "bg-emerald-100 text-emerald-800 border-emerald-200",
  customer_response: "bg-violet-100 text-violet-800 border-violet-200",
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

function initiativeLabel(row: InitiativeRow): string {
  const ref = (row as Record<string, unknown>).external_ref as string | null | undefined;
  if (ref) return ref;
  return row.initiative_id;
}

function initiativeCreatedTs(row: InitiativeRow): string | null | undefined {
  const ts = (row as Record<string, unknown>).created_ts as string | null | undefined;
  if (ts) return ts;
  return row.created_at;
}

function ownerInitials(id: string | null | undefined): string {
  if (!id) return "?";
  return id.slice(0, 2).toUpperCase();
}

// ─── Refresh island (client) ──────────────────────────────────────────────────

function RefreshButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
    >
      <RotateCw className="size-3" />
      Refresh
    </Button>
  );
}

// ─── Initiative card ──────────────────────────────────────────────────────────

function InitiativeCard({ initiative }: { initiative: InitiativeRow }) {
  const sys = formatSystem(initiative.target_system);
  const sysBadge = SYSTEM_BADGE[sys] ?? SYSTEM_BADGE.Manex;
  const domainBadge =
    DOMAIN_BADGE[initiative.agent_domain] ?? DOMAIN_BADGE.production;

  return (
    <Card
      data-testid={`kanban-card-${initiative.initiative_id}`}
      size="sm"
      className="mb-2 transition-colors hover:border-primary/30"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0">
        <span className="font-mono text-[10px] font-medium uppercase text-muted-foreground">
          {initiative.initiative_id}
        </span>
        {initiative.incident_id && (
          <Link
            href={`/incident/${encodeURIComponent(initiative.incident_id)}`}
            className="font-mono text-[10px] font-semibold text-primary hover:underline whitespace-nowrap"
          >
            ← {initiative.incident_id}
          </Link>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-1.5">
        <div className="text-xs font-medium leading-snug text-foreground break-words">
          {initiative.agent_domain} → {formatSystem(initiative.target_system)}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {initiativeLabel(initiative)}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <Badge
            className={cn(
              "uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5",
              sysBadge,
            )}
          >
            {sys}
          </Badge>
          <Badge
            className={cn(
              "uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5",
              domainBadge,
            )}
          >
            {initiative.agent_domain}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="px-3 py-2 flex items-center justify-between gap-2 bg-muted/30 border-t-border">
        {initiative.owner_user_id ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <Avatar size="sm" className="shrink-0 size-5">
              <AvatarFallback className="text-[8px] font-bold bg-muted text-muted-foreground">
                {ownerInitials(initiative.owner_user_id)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground truncate">
              {initiative.owner_user_id}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">unassigned</span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground">
          {formatDate(initiativeCreatedTs(initiative))}
        </span>
      </CardFooter>
    </Card>
  );
}

// ─── Kanban board ─────────────────────────────────────────────────────────────

type Props = {
  initiatives: InitiativeRow[];
};

export function InitiativesKanban({ initiatives }: Props) {
  const byStatus = new Map<string, InitiativeRow[]>();
  for (const col of COLUMNS) {
    byStatus.set(col.id, []);
  }
  for (const init of initiatives) {
    const status = init.status as string;
    if (byStatus.has(status)) {
      byStatus.get(status)!.push(init);
    } else {
      byStatus.get("proposed")!.push(init);
    }
  }

  return (
    <div data-testid="initiatives-kanban">
      <div className="flex items-center justify-end px-6 pt-3 pb-1">
        <RefreshButton />
      </div>

      <div className="px-4 pb-6 overflow-x-auto">
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(230px, 1fr))`,
          }}
        >
          {COLUMNS.map((col) => {
            const cards = byStatus.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                data-testid={`kanban-col-${col.id}`}
                className="flex flex-col"
              >
                <div className="flex items-center justify-between px-2.5 py-2">
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      col.tint ?? "text-muted-foreground",
                    )}
                  >
                    {col.label}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-semibold tabular-nums h-5 min-w-5 justify-center px-1.5"
                  >
                    {cards.length}
                  </Badge>
                </div>

                <div className="flex-1 rounded-lg bg-muted/40 border border-border p-2 min-h-[80px]">
                  {cards.length === 0 ? (
                    <p className="m-0 px-1.5 py-3 text-center text-[11px] text-muted-foreground">
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
