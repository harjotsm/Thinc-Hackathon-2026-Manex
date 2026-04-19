"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import type { ReportInitiative } from "@/server/incident/loaders";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type Props = {
  initiatives: ReportInitiative[];
  incidentId: string;
  productId?: string | null;
};

type DispatchState = "idle" | "dispatching" | "done" | "error";

const DOMAIN_BADGE: Record<string, string> = {
  production:        "bg-blue-100 text-blue-800 border-blue-200",
  supplier:          "bg-orange-100 text-orange-800 border-orange-200",
  rnd:               "bg-pink-100 text-pink-800 border-pink-200",
  logistics:         "bg-emerald-100 text-emerald-800 border-emerald-200",
  customer_response: "bg-violet-100 text-violet-800 border-violet-200",
};

const SYSTEM_LABEL: Record<string, string> = {
  mes: "MES",
  srm: "SRM",
  jira: "JIRA",
  erp: "ERP",
  crm: "CRM",
  manex: "Manex",
};

const formatTarget = (target: string): string => {
  const lower = target.toLowerCase().trim();
  for (const [k, v] of Object.entries(SYSTEM_LABEL)) {
    if (lower.includes(k)) return v;
  }
  return target;
};

/** Map a ReportInitiative to the body expected by POST /api/initiative/approve */
export function buildApprovePayload(init: ReportInitiative, incidentId: string, productId?: string | null) {
  const domainMap: Record<string, string> = {
    production: "production",
    supplier: "supplier",
    rnd: "rnd",
    logistics: "logistics",
    customer_response: "customer_response",
  };
  const agent_domain =
    domainMap[(init.domain ?? "").toLowerCase()] ?? "production";

  const closure_predicate = init.closure_predicate ?? {
    type: "manual_confirmation" as const,
    params: {},
  };

  const target_system =
    typeof init.target_system === "string" && init.target_system.trim().length > 0
      ? init.target_system
      : "mes";

  return {
    incident_id: incidentId,
    agent_domain,
    target_system,
    comments: init.rationale,
    closure_predicate,
    status: "approved" as const,
    ...(productId && { product_id: productId }),
  };
}

const ownerInitials = (name: string): string => {
  const parts = name.split(/[\s,·]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

export function InitiativesPreview({ initiatives, incidentId, productId }: Props) {
  const [approved, setApproved] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(initiatives.map((_, i) => [i, true])),
  );

  const [dispatchState, setDispatchState] = useState<DispatchState>("idle");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const approvedCount = useMemo(
    () => Object.values(approved).filter(Boolean).length,
    [approved],
  );

  const handleDispatch = async () => {
    if (dispatchState === "dispatching" || approvedCount === 0) return;

    const toDispatch = initiatives
      .map((init, i) => ({ init, i }))
      .filter(({ i }) => approved[i]);

    setDispatchState("dispatching");
    setDispatchError(null);

    try {
      let successCount = 0;
      for (const { init } of toDispatch) {
        const payload = buildApprovePayload(init, incidentId, productId);
        const res = await fetch("/api/initiative/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          successCount += 1;
        } else {
          let msg = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            if (body?.error) msg = body.error;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }
      }
      setCreatedCount(successCount);
      setDispatchState("done");
    } catch (err) {
      setDispatchState("error");
      setDispatchError(
        err instanceof Error ? err.message : "Dispatch failed",
      );
    }
  };

  if (initiatives.length === 0) {
    return (
      <Card data-testid="initiatives-preview-empty" size="sm">
        <CardContent className="text-center py-6">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
            Suggested initiatives
          </div>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            AI will propose initiatives once reasoning completes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section data-testid="initiatives-preview">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-primary inline-flex items-center gap-1.5">
          <Sparkles className="size-3" aria-hidden />
          Suggested initiatives ({initiatives.length})
        </span>
        <span className="text-xs text-muted-foreground">approve to dispatch</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {initiatives.map((init, i) => {
          const tint = DOMAIN_BADGE[init.domain] ?? DOMAIN_BADGE.production;
          const isApproved = approved[i] ?? false;
          const target = formatTarget(init.target_system);
          return (
            <Card
              key={`${init.title}-${i}`}
              data-testid={`initiative-card-${i}`}
              size="sm"
              className={cn(
                "transition-all duration-150 flex flex-col",
                isApproved
                  ? "ring-emerald-500/30 ring-2"
                  : "opacity-65",
              )}
            >
              <CardHeader className="pb-0 flex flex-row items-center gap-1.5 flex-wrap">
                <Badge
                  className={cn(
                    "uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5",
                    tint,
                  )}
                >
                  {init.domain}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5"
                >
                  → {target}
                </Badge>
                <div className="flex-1" />
                <span className="text-[11px] font-mono font-semibold text-primary tabular-nums">
                  {Math.round(init.confidence * 100)}%
                </span>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-2 pt-2">
                <h4 className="text-sm font-semibold leading-snug text-foreground m-0">
                  {init.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 m-0">
                  {init.rationale}
                </p>
              </CardContent>

              <CardFooter className="bg-muted/30 border-t-border flex items-center gap-2 px-3 py-2">
                <Avatar size="sm">
                  <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                    {ownerInitials(init.owner_hint)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[11px] text-muted-foreground truncate">
                  {init.owner_hint}
                </span>
                <div className="flex-1" />
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                  <input
                    type="checkbox"
                    checked={isApproved}
                    onChange={(e) =>
                      setApproved((cur) => ({ ...cur, [i]: e.target.checked }))
                    }
                    aria-label={`Approve initiative ${init.title}`}
                    className="size-3.5 accent-emerald-600 cursor-pointer"
                  />
                  <span
                    className={cn(
                      "font-semibold",
                      isApproved ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {isApproved ? "Approved" : "Skip"}
                  </span>
                </label>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">
          {approvedCount} of {initiatives.length} approved
        </span>

        {dispatchState === "done" && (
          <span
            data-testid="dispatch-success"
            className="text-xs font-semibold text-emerald-700"
          >
            ✓ {createdCount} initiative{createdCount === 1 ? "" : "s"} created
          </span>
        )}

        {dispatchState === "error" && dispatchError && (
          <span data-testid="dispatch-error" className="text-xs text-destructive">
            {dispatchError}
          </span>
        )}

        <Separator orientation="vertical" className="h-4 hidden md:block" />

        <div className="flex-1" />

        {dispatchState === "done" ? (
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href={`/initiatives?incident=${encodeURIComponent(incidentId)}`} />
            }
            data-testid="view-kanban-link"
          >
            View kanban →
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            render={
              <Link href={`/initiatives?incident=${encodeURIComponent(incidentId)}`} />
            }
          >
            Track in Kanban →
          </Button>
        )}

        <Button
          type="button"
          data-testid="dispatch-button"
          variant="default"
          size="sm"
          disabled={
            dispatchState === "dispatching" ||
            dispatchState === "done" ||
            approvedCount === 0
          }
          aria-busy={dispatchState === "dispatching"}
          onClick={handleDispatch}
        >
          <Send className="size-3" />
          {dispatchState === "dispatching"
            ? "Dispatching…"
            : dispatchState === "done"
              ? "Dispatched ✓"
              : dispatchState === "error"
                ? "Retry dispatch"
                : `Dispatch selected (${approvedCount})`}
        </Button>
      </div>
    </section>
  );
}
