"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function EngineerInvestigatePage() {
  const params = useParams<{ incidentId: string }>();
  const incidentId = params.incidentId;

  const [incident, setIncident] = useState<Incident | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [message, setMessage] = useState("Loading incident...");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      const [incidentResponse, signalLinkResponse] = await Promise.all([
        fetch(`/api/incident/${incidentId}`),
        fetch(`/api/incident/${incidentId}/signals`),
      ]);

      if (!active) return;
      if (!incidentResponse.ok) {
        setMessage("Failed to load incident.");
        return;
      }

      const incidentData = (await incidentResponse.json()) as { incident: Incident };
      const signalData = (await signalLinkResponse.json()) as { signals: Signal[] };
      setIncident(incidentData.incident);
      setSignals(signalData.signals ?? []);
      setMessage("");
    };

    void load();
    return () => {
      active = false;
    };
  }, [incidentId]);

  const runReasoning = async () => {
    setMessage("Running reasoning pipeline...");
    const response = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident_id: incidentId }),
    });
    const json = (await response.json()) as AgentResult & { error?: string };
    if (!response.ok) {
      setMessage(`Failed: ${json.error ?? "unknown error"}`);
      return;
    }
    setResult(json);
    setMessage("Reasoning complete.");
  };

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

  const severityPill = useMemo(() => {
    const severity = incident?.severity ?? "unknown";
    return (
      <span className="rounded bg-zinc-100 px-2 py-1 text-xs uppercase tracking-wide">{severity}</span>
    );
  }, [incident?.severity]);

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

  const citedEvidence = useMemo(() => new Set(result?.draft_8d.evidence ?? []), [result?.draft_8d.evidence]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Engineer Lens — Incident {incidentId}</h1>
          <p className="text-sm text-zinc-600">{incident?.title ?? "Untitled incident"}</p>
        </div>
        {severityPill}
      </header>

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
            <p className="text-sm text-zinc-500">Run reasoning to generate draft.</p>
          )}
        </section>

        <section className="rounded border border-zinc-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Evidence trace</h2>
          {result ? (
            <ul className="space-y-2 text-sm">
              {result.tool_calls.map((call) => (
                <li key={call.tool_call_id} className="rounded bg-zinc-50 p-2">
                  <p className="font-medium">
                    {call.tool} <span className="text-xs text-zinc-500">({call.tool_call_id})</span>
                  </p>
                  <p className="text-zinc-600">{call.summary}</p>
                  <p className="text-xs">
                    {citedEvidence.has(call.tool_call_id) ? "Cited in draft 8D evidence." : "Not cited in final draft."}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No evidence yet.</p>
          )}
        </section>

        <section className="rounded border border-zinc-200 p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Initiatives</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {result?.initiatives.map((initiative, index) => (
              <div key={initiative.title} className="rounded bg-zinc-50 p-3 text-sm">
                <p className="font-medium">{initiative.title}</p>
                <p className="text-xs uppercase text-zinc-600">{initiative.domain}</p>
                <p className="mt-1">{initiative.rationale}</p>
                <p className="mt-2 text-xs text-zinc-600">Confidence: {(initiative.confidence * 100).toFixed(0)}%</p>
                <p className="text-xs text-zinc-600">Evidence: {initiative.evidence.join(", ")}</p>
                <button
                  onClick={() => approve(index)}
                  className="mt-3 rounded bg-black px-3 py-1.5 text-xs text-white"
                >
                  Approve
                </button>
              </div>
            ))}
            {!result ? <p className="text-zinc-500">No initiatives yet.</p> : null}
          </div>
        </section>

        <section className="rounded border border-zinc-200 p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Reasoning phases</h2>
          {result ? (
            <ol className="space-y-2 text-sm">
              {result.phases.map((phase, index) => (
                <li key={`${phase.phase}-${index}`} className="rounded bg-zinc-50 p-2">
                  <strong>{phase.phase}</strong>: {phase.detail}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">Run reasoning to see the phase trace.</p>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={runReasoning} className="rounded bg-black px-4 py-2 text-white">
          Run Reasoning
        </button>
      </div>

      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
      {saving ? <p className="text-sm text-zinc-700">{saving}</p> : null}
    </main>
  );
}
