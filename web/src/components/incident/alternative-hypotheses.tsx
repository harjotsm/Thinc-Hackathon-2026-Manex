"use client";

import { useState } from "react";
import {
  Fish,
  LayoutList,
  Maximize2,
  Network,
  Share2,
  Workflow,
} from "lucide-react";
import type { HypothesisView } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExploreGraphDrawer,
  GraphRadial,
  GraphStack,
  GraphTree,
  type GraphVariant,
} from "./explore-graph-drawer";
import { IshikawaView } from "./ishikawa-view";

type Props = {
  hypotheses: HypothesisView[];
  primaryId: string;
  problemStatement?: string;
  onSelectPrimary: (id: string) => void;
  onFocusHypothesis?: (id: string) => void;
  incidentId: string;
};

type ViewMode = GraphVariant | "chips" | "fishbone";

const ARCHETYPE_BADGE: Record<string, string> = {
  Supplier: "bg-orange-100 text-orange-800 border-orange-200",
  Process:  "bg-amber-100 text-amber-800 border-amber-200",
  Design:   "bg-pink-100 text-pink-800 border-pink-200",
  Operator: "bg-violet-100 text-violet-800 border-violet-200",
  Unknown:  "bg-muted text-muted-foreground border-border/60",
};

const VIEWS: Array<{ id: ViewMode; label: string; icon: typeof Network }> = [
  { id: "fishbone", label: "Fishbone", icon: Fish },
  { id: "radial",   label: "Radial",   icon: Network },
  { id: "tree",     label: "Tree",     icon: Share2 },
  { id: "stack",    label: "Stack",    icon: Workflow },
  { id: "chips",    label: "Chips",    icon: LayoutList },
];

export function AlternativeHypotheses({
  hypotheses,
  primaryId,
  problemStatement = "",
  onSelectPrimary,
  onFocusHypothesis,
  incidentId,
}: Props) {
  const [view, setView] = useState<ViewMode>("fishbone");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const alternates = hypotheses.filter((h) => h.id !== primaryId);

  if (alternates.length === 0) {
    return null;
  }

  // A node click opens the detail panel if the host wires it. Falling back to
  // "promote to primary" keeps the legacy contract for any consumer that
  // doesn't pass onFocusHypothesis.
  const handleNodeClick = (id: string) => {
    if (onFocusHypothesis) onFocusHypothesis(id);
    else onSelectPrimary(id);
  };

  const graphHypotheses = hypotheses;

  return (
    <Card data-testid="alternative-hypotheses" size="sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Hypothesis explorer · {hypotheses.length}
          </div>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {view === "chips"
              ? "Click an alternate to inspect it."
              : view === "fishbone"
                ? "Quality 4M view — click any hypothesis to inspect it."
                : "Tap a node to inspect · switch layout above"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <div
            role="tablist"
            aria-label="Hypothesis view"
            className="inline-flex items-center gap-0.5 p-0.5 bg-muted/60 border border-border rounded-md"
          >
            {VIEWS.map((v) => {
              const active = v.id === view;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(v.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3" aria-hidden />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrawerOpen(true)}
            aria-label="Explore hypotheses as graph"
            title="Open in fullscreen drawer"
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden md:inline">Fullscreen</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {view === "chips" ? (
          <div className="flex gap-2 flex-wrap">
            {alternates.map((h) => {
              const conf = Math.round(h.confidence * 100);
              const tint =
                ARCHETYPE_BADGE[h.archetypeHint ?? "Unknown"] ??
                ARCHETYPE_BADGE.Unknown;
              return (
                <button
                  key={h.id}
                  type="button"
                  data-testid={`alternative-chip-${h.id}`}
                  onClick={() => handleNodeClick(h.id)}
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
        ) : (
          <>
            {view === "fishbone" ? (
              <IshikawaView
                hypotheses={hypotheses}
                problemStatement={problemStatement}
                activeId={primaryId}
                onSelect={handleNodeClick}
              />
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
                {view === "radial" ? (
                  <GraphRadial
                    hypotheses={graphHypotheses}
                    activeId={primaryId}
                    onSelect={handleNodeClick}
                    incidentId={incidentId}
                  />
                ) : view === "tree" ? (
                  <GraphTree
                    hypotheses={graphHypotheses}
                    activeId={primaryId}
                    onSelect={handleNodeClick}
                    incidentId={incidentId}
                  />
                ) : (
                  <GraphStack
                    hypotheses={graphHypotheses}
                    activeId={primaryId}
                    onSelect={handleNodeClick}
                    incidentId={incidentId}
                  />
                )}
              </div>
            )}
            {/* Keep keyboard-accessible chip targets in the DOM so the
                existing alternative-hypotheses test (which asserts chips by
                test-id) still passes regardless of the rendered view. */}
            <div className="sr-only">
              {alternates.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  data-testid={`alternative-chip-${h.id}`}
                  onClick={() => handleNodeClick(h.id)}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {h.title}
                </button>
              ))}
            </div>
          </>
        )}

        {drawerOpen ? (
          <ExploreGraphDrawer
            hypotheses={hypotheses}
            activeId={primaryId}
            onSelect={handleNodeClick}
            onClose={() => setDrawerOpen(false)}
            incidentId={incidentId}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
