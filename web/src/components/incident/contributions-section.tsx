"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Factory,
  FileText,
  FlaskConical,
  Landmark,
  PackageSearch,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ContributionRow } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  contributions: ContributionRow[];
};

const DOMAIN_ICON: Record<string, LucideIcon> = {
  central_quality: Factory,
  plant_quality_direct: Building2,
  supplier_quality: PackageSearch,
  market_research: Users,
  process_planner: FileText,
  rnd: FlaskConical,
  operator_rep: CircleDot,
  finance: Landmark,
  logistics: Truck,
};

const STATUS_TINT: Record<string, { dot: string; label: string }> = {
  available:    { dot: "bg-emerald-500",   label: "Available" },
  live:         { dot: "bg-primary",       label: "Live" },
  contributed:  { dot: "bg-emerald-500",   label: "Contributed" },
  pending:      { dot: "bg-muted-foreground", label: "Pending" },
  dismissed:    { dot: "bg-zinc-300",      label: "Dismissed" },
};

const prettyDomain = (domain: string): string =>
  domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Try to parse a structured contribution summary into key-value pairs.
// The orchestrator sometimes emits text like:
//   "Batches referenced in signals: SB-00007 Suppliers involved: ElektroParts"
// We split on `<Word>:` boundaries and produce a tidy <dl>.
type Parsed =
  | { kind: "kv"; pairs: Array<{ key: string; value: string }> }
  | { kind: "raw"; text: string };

function parseSummary(text: string): Parsed {
  if (!text) return { kind: "raw", text: "" };
  // Match `Key1: value1 Key2: value2` style, where each "Key" is 1-4 words
  // ending in a colon.
  const re = /([A-Z][\w() ]{2,40}):\s+/g;
  const matches: Array<{ key: string; idx: number; len: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ key: m[1].trim(), idx: m.index, len: m[0].length });
  }
  // Need at least 2 distinct headings to count as structured.
  if (matches.length < 2) return { kind: "raw", text };

  const pairs: Array<{ key: string; value: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx + matches[i].len;
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length;
    const value = text.slice(start, end).trim();
    pairs.push({ key: matches[i].key, value });
  }
  return { kind: "kv", pairs };
}

export function ContributionsSection({ contributions }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (contributions.length === 0) {
    return (
      <Card data-testid="contributions-empty" size="sm">
        <CardContent className="text-center py-5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
            Stakeholder contributions
          </div>
          <p className="text-xs text-muted-foreground m-0">
            No contributions yet. Domain agents will enrich context as they respond.
          </p>
        </CardContent>
      </Card>
    );
  }

  const visible = showAll ? contributions : contributions.slice(0, 3);

  return (
    <section data-testid="contributions-section">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Stakeholder contributions ({contributions.length})
        </span>
        <div className="flex-1" />
        {contributions.length > 3 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
          >
            {showAll ? (
              <>
                Show top 3
                <ChevronUp className="size-3" />
              </>
            ) : (
              <>
                Show all {contributions.length}
                <ChevronDown className="size-3" />
              </>
            )}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((c) => {
          const status = STATUS_TINT[c.status ?? "available"] ?? STATUS_TINT.available;
          const Icon = DOMAIN_ICON[c.domain] ?? CircleDot;
          const summary =
            c.content ?? (c.structured_payload ? JSON.stringify(c.structured_payload) : "");
          const dismissed = c.status === "dismissed";
          const parsed = summary ? parseSummary(summary) : null;
          return (
            <Card
              key={c.contribution_id}
              data-testid={`contribution-${c.contribution_id}`}
              size="sm"
              className={cn(
                "transition-opacity",
                dismissed && "opacity-50",
              )}
            >
              <CardHeader className="flex flex-row items-center gap-2 pb-0">
                <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                  <Icon size={14} aria-hidden />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                  <span className="text-xs font-semibold text-foreground">
                    {prettyDomain(c.domain)}
                  </span>
                  <span
                    className={cn("size-1.5 rounded-full shrink-0", status.dot)}
                    aria-hidden
                  />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {status.label}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono text-muted-foreground px-1.5 shrink-0"
                >
                  {c.source}
                </Badge>
              </CardHeader>
              <CardContent className="pl-12">
                {summary ? (
                  parsed?.kind === "kv" ? (
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
                      {parsed.pairs.map((p, i) => (
                        <div key={i} className="contents">
                          <dt className="text-muted-foreground font-medium">
                            {p.key}
                          </dt>
                          <dd
                            className={cn(
                              "text-foreground/85 m-0 truncate",
                              dismissed && "line-through",
                            )}
                          >
                            {p.value || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p
                      className={cn(
                        "text-xs text-muted-foreground leading-relaxed m-0 line-clamp-3",
                        dismissed && "line-through",
                      )}
                    >
                      {summary}
                    </p>
                  )
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
