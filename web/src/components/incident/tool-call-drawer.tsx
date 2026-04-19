"use client";

import { Terminal, X } from "lucide-react";
import type { ReportToolCall } from "@/server/incident/loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  toolCall: ReportToolCall | null;
  onClose: () => void;
};

const prettyTool = (tool: string): string =>
  tool
    .split(/[_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const partitionData = (data: unknown): {
  input: unknown;
  output: unknown;
  meta: unknown;
} => {
  if (!data || typeof data !== "object") {
    return { input: null, output: data ?? null, meta: null };
  }
  const obj = data as Record<string, unknown>;
  const input = obj.input ?? obj.params ?? obj.args ?? obj.query ?? null;
  const output = obj.output ?? obj.result ?? obj.rows ?? obj.response ?? data;
  const meta: Record<string, unknown> = {};
  if (typeof obj.duration_ms === "number") meta.duration_ms = obj.duration_ms;
  if (typeof obj.model === "string") meta.model = obj.model;
  if (typeof obj.tokens === "number") meta.tokens = obj.tokens;
  if (typeof obj.row_count === "number") meta.row_count = obj.row_count;
  return {
    input,
    output: output === data ? data : output,
    meta: Object.keys(meta).length > 0 ? meta : null,
  };
};

export function ToolCallDrawer({ toolCall, onClose }: Props) {
  if (!toolCall) return null;

  const { input, output, meta } = partitionData(toolCall.data);

  return (
    <div
      role="dialog"
      aria-label={`Tool call ${toolCall.tool_call_id}`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-foreground/40 flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(560px,100vw)] h-full bg-card border-l border-border p-6 overflow-auto shadow-xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            aria-hidden
            className="inline-flex items-center justify-center size-6 rounded bg-violet-100 text-violet-700"
          >
            <Terminal className="size-3.5" />
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Tool call
          </span>
          <Badge
            variant="outline"
            className="font-mono text-[10px] font-medium px-1.5 py-0 h-5"
            title={toolCall.tool_call_id}
          >
            {toolCall.tool_call_id}
          </Badge>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close tool call drawer"
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1">
          {prettyTool(toolCall.tool)}
        </h3>
        <div className="font-mono text-[11px] text-muted-foreground mb-4">
          {toolCall.tool}
        </div>

        {toolCall.summary ? (
          <section className="mb-4">
            <SectionLabel>Summary</SectionLabel>
            <p className="text-sm text-foreground/85 leading-relaxed">
              {toolCall.summary}
            </p>
          </section>
        ) : null}

        {meta ? (
          <section className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(meta).map(([k, v]) => (
              <MetaTile key={k} label={k.replace(/_/g, " ")} value={String(v)} />
            ))}
          </section>
        ) : null}

        {input ? (
          <section className="mb-4">
            <SectionLabel>Input</SectionLabel>
            <JsonBlock content={safeStringify(input)} />
          </section>
        ) : null}

        {output ? (
          <section className="mb-4">
            <SectionLabel>Output</SectionLabel>
            <JsonBlock content={safeStringify(output)} />
          </section>
        ) : !input && !meta ? (
          <section className="mb-4">
            <SectionLabel>Raw</SectionLabel>
            <JsonBlock content={safeStringify(toolCall.data ?? {})} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
      {children}
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
        {label}
      </div>
      <div className="text-sm font-mono tabular-nums">{value}</div>
    </div>
  );
}

function JsonBlock({ content }: { content: string }) {
  return (
    <pre
      className={cn(
        "text-[11px] font-mono leading-relaxed p-3 rounded-md",
        "bg-muted/50 border border-border/60 overflow-x-auto whitespace-pre",
      )}
    >
      {content}
    </pre>
  );
}
