"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Domain types ─────────────────────────────────────────────────────────────

type Incident = {
  incident_id: string;
  title: string | null;
  summary: string | null;
  severity: string | null;
  primary_product_id: string | null;
  status: string;
};

type Signal = {
  signal_id: string;
  signal_type: string;
  source_system: string;
  captured_ts: string;
  text_payload: string | null;
};

type ToolCall = {
  tool_call_id: string;
  tool: string;
  summary: string;
};

type AgentResult = {
  archetype: string;
  tool_calls: ToolCall[];
  phases: Array<{ phase: string; detail: string }>;
  draft_8d: {
    problem: string;
    containment: string[];
    likely_root_causes: string[];
    evidence: string[];
    claims?: Array<{ claim: string; evidence: string[] }>;
  };
  initiatives: Array<{
    title: string;
    domain: "production" | "supplier" | "rnd";
    rationale: string;
    confidence: number;
    evidence: string[];
    closure_predicate: { type: string; params: Record<string, unknown> };
  }>;
};

// ─── SSE event shape ──────────────────────────────────────────────────────────

type PhaseEvent = {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  ts: string;
};

// ─── Phase chip config ────────────────────────────────────────────────────────

const PHASES = ["idle", "classify", "investigate", "compose", "propose", "complete"] as const;
type PhaseName = (typeof PHASES)[number];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EngineerInvestigatePage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = params.incidentId;

  // ── Incident / signal data ────────────────────────────────────────────────
  const [incident, setIncident] = useState<Incident | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);

  // ── Session / SSE state ───────────────────────────────────────────────────
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<"idle" | "running" | "succeeded" | "failed">("idle");
  const [currentPhase, setCurrentPhase] = useState<PhaseName>("idle");
  const [phaseEvents, setPhaseEvents] = useState<PhaseEvent[]>([]);
  const [liveText, setLiveText] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");

  // ── Final result (fetched after session_complete) ─────────────────────────
  const [result, setResult] = useState<AgentResult | null>(null);

  // ── Approval state ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState<string>("");

  const esRef = useRef<EventSource | null>(null);

  // ── Load incident + signals on mount ─────────────────────────────────────
  useEffect(() => {
    let active = true;

    const load = async () => {
      const [incidentRes, signalRes] = await Promise.all([
        fetch(`/api/incident/${incidentId}`),
        fetch(`/api/incident/${incidentId}/signals`),
      ]);
      if (!active) return;
      if (!incidentRes.ok) {
        setStatusMsg("Failed to load incident.");
        return;
      }
      const incidentData = (await incidentRes.json()) as { incident: Incident };
      const signalData = (await signalRes.json()) as { signals: Signal[] };
      setIncident(incidentData.incident);
      setSignals(signalData.signals ?? []);
    };

    void load();
    return () => {
      active = false;
    };
  }, [incidentId]);

  // ── Start a new investigation session ────────────────────────────────────
  const start = async () => {
    if (!incidentId || runStatus === "running") return;
    setRunStatus("running");
    setPhaseEvents([]);
    setLiveText("");
    setResult(null);
    setStatusMsg("Starting investigation...");

    const r = await fetch(`/api/incident/${incidentId}/investigate`, {
      method: "POST",
      headers: {
        "X-Demo-User": "user_eng_anna",
        "Content-Type": "application/json",
      },
    });

    const body = (await r.json()) as {
      session_id?: string;
      error?: string;
      code?: string;
    };

    if (!r.ok) {
      // 409 means another session is already running — reuse its stream
      if (r.status === 409 && body.session_id) {
        setStatusMsg("Session already running — reconnecting to stream...");
        setSessionId(body.session_id);
        return;
      }
      setRunStatus("failed");
      setStatusMsg(`Failed to start: ${body.error ?? body.code ?? "unknown error"}`);
      return;
    }

    if (!body.session_id) {
      setRunStatus("failed");
      setStatusMsg("Server returned no session_id.");
      return;
    }

    setStatusMsg("Investigation running…");
    setSessionId(body.session_id);
  };

  // ── Open EventSource when sessionId is set ────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/session/${sessionId}/stream`);
    esRef.current = es;

    es.addEventListener("phase_start", (e: MessageEvent) => {
      const ev = JSON.parse(e.data as string) as {
        event_seq: number;
        event_type: string;
        payload: { phase: string };
        ts: string;
      };
      setCurrentPhase(ev.payload.phase as PhaseName);
      setPhaseEvents((prev) => [
        ...prev,
        { seq: ev.event_seq, type: "phase_start", payload: ev.payload as Record<string, unknown>, ts: ev.ts },
      ]);
      setLiveText(""); // reset live-text pane at each phase boundary
    });

    es.addEventListener("phase_complete", (e: MessageEvent) => {
      const ev = JSON.parse(e.data as string) as {
        event_seq: number;
        event_type: string;
        payload: Record<string, unknown>;
        ts: string;
      };
      setPhaseEvents((prev) => [
        ...prev,
        { seq: ev.event_seq, type: "phase_complete", payload: ev.payload, ts: ev.ts },
      ]);
    });

    es.addEventListener("token_delta", (e: MessageEvent) => {
      const ev = JSON.parse(e.data as string) as {
        payload: { text?: string };
      };
      setLiveText((prev) => prev + (ev.payload.text ?? ""));
    });

    es.addEventListener("tool_result", (e: MessageEvent) => {
      const ev = JSON.parse(e.data as string) as {
        event_seq: number;
        event_type: string;
        payload: Record<string, unknown>;
        ts: string;
      };
      setPhaseEvents((prev) => [
        ...prev,
        { seq: ev.event_seq, type: "tool_result", payload: ev.payload, ts: ev.ts },
      ]);
    });

    es.addEventListener("session_complete", async (e: MessageEvent) => {
      setCurrentPhase("complete");
      setRunStatus("succeeded");
      setStatusMsg("Investigation complete.");
      es.close();
      esRef.current = null;

      // Fetch the final result from the batch run endpoint via the incident route
      try {
        const resultRes = await fetch(`/api/incident/${incidentId}/investigate/result`);
        if (resultRes.ok) {
          const data = (await resultRes.json()) as AgentResult;
          setResult(data);
        }
      } catch {
        // result endpoint not yet available — that's fine for demo
      }
    });

    es.addEventListener("session_failed", () => {
      setRunStatus("failed");
      setStatusMsg("Investigation failed. Check logs.");
      es.close();
      esRef.current = null;
    });

    es.onerror = () => {
      // EventSource auto-reconnects via Last-Event-ID; don't override
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId, incidentId]);

  // ── Approve an initiative ─────────────────────────────────────────────────
  const approve = async (initiativeIndex: number) => {
    if (!incident?.primary_product_id || !result) {
      setSaving("Need primary_product_id on incident before approval.");
      return;
    }
    const selected = result.initiatives[initiativeIndex];
    setSaving(`Approving "${selected.title}"...`);
    const response = await fetch("/api/initiative/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: incidentId,
        agent_domain: selected.domain,
        target_system: selected.domain === "rnd" ? "jira" : "manex_product_action",
        owner_user_id: "quality_engineer",
        status: "approved",
        closure_predicate: selected.closure_predicate,
        product_id: incident.primary_product_id,
        comments: selected.rationale,
      }),
    });

    const json = (await response.json()) as { initiative?: { initiative_id: string }; error?: string };
    if (!response.ok) {
      setSaving(`Approval failed: ${json.error ?? "unknown error"}`);
      return;
    }
    setSaving(`Approved initiative ${json.initiative?.initiative_id ?? ""}`);
  };

  // ── Derived chart data ────────────────────────────────────────────────────

  const sourceChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const signal of signals) {
      counts.set(signal.source_system, (counts.get(signal.source_system) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }, [signals]);

  const timelineData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const signal of signals) {
      const day = signal.captured_ts.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [signals]);

  const citedEvidence = useMemo(
    () => new Set(result?.draft_8d.evidence ?? []),
    [result?.draft_8d.evidence],
  );

  const severityPill = useMemo(() => {
    const severity = incident?.severity ?? "unknown";
    return (
      <span className="rounded bg-zinc-100 px-2 py-1 text-xs uppercase tracking-wide">
        {severity}
      </span>
    );
  }, [incident?.severity]);

  // ── Phase chips ───────────────────────────────────────────────────────────

  const phaseChips = PHASES.map((p) => {
    const isActive = currentPhase === p;
    const isDone =
      PHASES.indexOf(p) < PHASES.indexOf(currentPhase) &&
      currentPhase !== "idle";
    return (
      <span
        key={p}
        className={[
          "rounded px-3 py-1 text-xs font-medium uppercase tracking-wide",
          isActive ? "bg-black text-white" : isDone ? "bg-zinc-200 text-zinc-600" : "bg-zinc-100 text-zinc-400",
        ].join(" ")}
      >
        {p}
      </span>
    );
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Engineer Lens — Incident {incidentId}</h1>
          <p className="text-sm text-zinc-600">{incident?.title ?? "Untitled incident"}</p>
        </div>
        {severityPill}
      </header>

      {/* Controls + phase chips */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => void start()}
          disabled={runStatus === "running"}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {runStatus === "running" ? "Investigating…" : "Investigate"}
        </button>
        <div className="flex flex-wrap gap-2">{phaseChips}</div>
      </div>

      {(statusMsg || saving) && (
        <p className="text-sm text-zinc-700">{saving || statusMsg}</p>
      )}

      {/* Live token-delta pane */}
      {runStatus === "running" && liveText && (
        <section className="rounded border border-zinc-200 bg-zinc-50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Live — {currentPhase}
          </h2>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-zinc-800">
            {liveText}
          </pre>
        </section>
      )}

      {/* Phase timeline */}
      {phaseEvents.length > 0 && (
        <section className="rounded border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Phase timeline</h2>
          <ol className="space-y-1 text-xs text-zinc-700">
            {phaseEvents.map((ev, idx) => (
              <li key={`${ev.seq}-${idx}`} className="flex gap-3">
                <span className="w-32 shrink-0 text-zinc-400">
                  {new Date(ev.ts).toLocaleTimeString()}
                </span>
                <span
                  className={[
                    "w-28 shrink-0 font-medium",
                    ev.type === "phase_start"
                      ? "text-blue-600"
                      : ev.type === "phase_complete"
                        ? "text-green-600"
                        : "text-zinc-600",
                  ].join(" ")}
                >
                  {ev.type}
                </span>
                <span className="truncate text-zinc-500">
                  {JSON.stringify(ev.payload).slice(0, 120)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded border border-zinc-200 p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Signal timeline</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#111827" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Signal sources</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="source" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#18181b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-zinc-600">
            {sourceChartData.map((row) => (
              <li key={row.source}>
                {row.source}: {row.count}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Signals</h2>
          <ul className="max-h-96 space-y-2 overflow-auto text-sm">
            {signals.map((signal) => (
              <li key={signal.signal_id} className="rounded bg-zinc-50 p-2">
                <p className="font-medium">{signal.signal_type}</p>
                <p className="text-xs text-zinc-600">
                  {signal.source_system} · {new Date(signal.captured_ts).toLocaleString()}
                </p>
                <p>{signal.text_payload ?? "No text payload."}</p>
              </li>
            ))}
            {signals.length === 0 ? <li className="text-zinc-500">No linked signals yet.</li> : null}
          </ul>
        </section>

        {/* Draft 8D — shown after completion */}
        <section className="rounded border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Draft 8D</h2>
          {result ? (
            <div className="space-y-3 text-sm">
              <p>
                <strong>Archetype:</strong> {result.archetype}
              </p>
              <p>
                <strong>Problem:</strong> {result.draft_8d.problem}
              </p>
              <p>
                <strong>Containment:</strong> {result.draft_8d.containment.join("; ")}
              </p>
              <p>
                <strong>Likely root causes:</strong> {result.draft_8d.likely_root_causes.join("; ")}
              </p>
              <p>
                <strong>Evidence IDs:</strong> {result.draft_8d.evidence.join(", ")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {runStatus === "running" ? "Analysis in progress…" : "Run investigation to generate draft."}
            </p>
          )}
        </section>

        {/* Evidence trace */}
        <section className="rounded border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Evidence trace</h2>
          {result ? (
            <ul className="space-y-2 text-sm">
              {result.tool_calls.map((call) => (
                <li key={call.tool_call_id} className="rounded bg-zinc-50 p-2">
                  <p className="font-medium">
                    {call.tool}{" "}
                    <span className="text-xs text-zinc-500">({call.tool_call_id})</span>
                  </p>
                  <p className="text-zinc-600">{call.summary}</p>
                  <p className="text-xs">
                    {citedEvidence.has(call.tool_call_id)
                      ? "Cited in draft 8D evidence."
                      : "Not cited in final draft."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No evidence yet.</p>
          )}
        </section>

        {/* Initiatives */}
        <section className="rounded border border-zinc-200 p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Initiatives</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {result?.initiatives.map((initiative, index) => (
              <div key={initiative.title} className="rounded bg-zinc-50 p-3 text-sm">
                <p className="font-medium">{initiative.title}</p>
                <p className="text-xs uppercase text-zinc-600">{initiative.domain}</p>
                <p className="mt-1">{initiative.rationale}</p>
                <p className="mt-2 text-xs text-zinc-600">
                  Confidence: {(initiative.confidence * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-zinc-600">
                  Evidence: {initiative.evidence.join(", ")}
                </p>
                <button
                  onClick={() => void approve(index)}
                  className="mt-3 rounded bg-black px-3 py-1.5 text-xs text-white"
                >
                  Approve
                </button>
              </div>
            ))}
            {!result ? (
              <p className="text-zinc-500">
                {runStatus === "running" ? "Initiatives being generated…" : "No initiatives yet."}
              </p>
            ) : null}
          </div>
        </section>

        {/* Reasoning phases (from final result) */}
        {result && (
          <section className="rounded border border-zinc-200 p-4 lg:col-span-3">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Reasoning phases</h2>
            <ol className="space-y-2 text-sm">
              {result.phases.map((phase, index) => (
                <li key={`${phase.phase}-${index}`} className="rounded bg-zinc-50 p-2">
                  <strong>{phase.phase}</strong>: {phase.detail}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
