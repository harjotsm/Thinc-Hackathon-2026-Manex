"use client";

import { useState } from "react";
import { Network } from "lucide-react";
import type { HypothesisView } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExploreGraphDrawer } from "./explore-graph-drawer";

type Props = {
  hypotheses: HypothesisView[];
  primaryId: string;
  onSelectPrimary: (id: string) => void;
  incidentId: string;
};

const ARCHETYPE_BADGE: Record<string, string> = {
  Supplier: "bg-orange-100 text-orange-800 border-orange-200",
  Process:  "bg-amber-100 text-amber-800 border-amber-200",
  Design:   "bg-pink-100 text-pink-800 border-pink-200",
  Operator: "bg-violet-100 text-violet-800 border-violet-200",
  Unknown:  "bg-zinc-100 text-zinc-700 border-zinc-200",
};

export function AlternativeHypotheses({
  hypotheses,
  primaryId,
  onSelectPrimary,
  incidentId,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const alternates = hypotheses.filter((h) => h.id !== primaryId);

  if (alternates.length === 0) {
    return null;
  }

  return (
    <Card data-testid="alternative-hypotheses" size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-0">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Alternative hypotheses ({alternates.length})
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Click a chip to focus
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDrawerOpen(true)}
          aria-label="Explore hypotheses as graph"
        >
          <Network className="size-3.5" />
          Explore as graph
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          {alternates.map((h) => {
            const conf = Math.round(h.confidence * 100);
            const tint = ARCHETYPE_BADGE[h.archetypeHint ?? "Unknown"] ?? ARCHETYPE_BADGE.Unknown;
            return (
              <button
                key={h.id}
                type="button"
                data-testid={`alternative-chip-${h.id}`}
                onClick={() => onSelectPrimary(h.id)}
                className="flex items-center gap-2 max-w-[280px] min-w-0 px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-muted/40 transition-colors text-xs text-foreground/85"
              >
                {h.archetypeHint ? (
                  <Badge
                    className={cn(
                      "uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5 shrink-0",
                      tint,
                    )}
                  >
                    {h.archetypeHint}
                  </Badge>
                ) : null}
                <span className="truncate flex-1">{h.title}</span>
                <span className="font-mono font-semibold text-muted-foreground shrink-0 text-[11px] tabular-nums">
                  {conf}%
                </span>
              </button>
            );
          })}
        </div>

        {drawerOpen ? (
          <ExploreGraphDrawer
            hypotheses={hypotheses}
            activeId={primaryId}
            onSelect={(id) => onSelectPrimary(id)}
            onClose={() => setDrawerOpen(false)}
            incidentId={incidentId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
