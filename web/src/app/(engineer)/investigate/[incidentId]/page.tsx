"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

type Initiative = {
  title: string;
  domain: "production" | "supplier" | "rnd";
  target_system: string;
  owner_hint: string;
  rationale: string;
  confidence: number;
  evidence: string[];
  closure_predicate: { type: string; params: Record<string, unknown> };
};

type ReportData = {
  report_id: string;
  incident_id: string;
  session_id: string;
  version: number;
  composed_by_model: string | null;
  composed_at: string | null;
  confidence: number | null;
  archetype: string | null;
  draft_8d: {
    problem: string;
    containment: string[];
    likely_root_causes: string[];
    evidence: string[];
    claims?: Array<{ claim: string; evidence: string[] }>;
  };
  initiatives: Initiative[];
  tool_calls: ToolCall[];
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

const sevClass = (severity: string | null | undefined): "low" | "med" | "high" | "crit" => {
  switch (severity) {
    case "critical":
      return "crit";
    case "high":
      return "high";
    case "low":
      return "low";
    case "medium":
    default:
      return "med";
  }
};

const statusClass = (status: string | null | undefined): "triage" | "reasoning" | "resolving" | "closed" => {
  switch (status) {
    case "reasoning":
      return "reasoning";
    case "resolving":
      return "resolving";
    case "closed":
      return "closed";
    case "triage":
    default:
      return "triage";
  }
};

const confidenceClass = (value: number): "conf-hi" | "conf-med" | "conf-lo" => {
  if (value >= 0.8) return "conf-hi";
  if (value >= 0.5) return "conf-med";
  return "conf-lo";
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

  // ── Final report (fetched after session_complete) ─────────────────────────
  const [report, setReport] = useState<ReportData | null>(null);

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

      // If session already succeeded, try to load existing report
      if (active) {
        try {
          const reportRes = await fetch(`/api/incident/${incidentId}/report`);
          if (reportRes.ok) {
            const reportData = (await reportRes.json()) as ReportData;
            setReport(reportData);
            setRunStatus("succeeded");
            setCurrentPhase("complete");
            setStatusMsg("Report loaded from previous session.");
          }
        } catch {
          // no existing report — that's fine
        }
      }
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
    setReport(null);
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

    es.addEventListener("session_complete", async () => {
      setCurrentPhase("complete");
      setRunStatus("succeeded");
      setStatusMsg("Investigation complete.");
      es.close();
      esRef.current = null;

      // Small delay to let the report persist before fetching
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Fetch the final report from the report endpoint
      try {
        const reportRes = await fetch(`/api/incident/${incidentId}/report`);
        if (reportRes.ok) {
          const reportData = (await reportRes.json()) as ReportData;
          setReport(reportData);
        }
      } catch {
        // report endpoint not available — that's fine for demo
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
  const approve = async (initiative: Initiative) => {
    if (!incident?.primary_product_id) {
      setSaving("Need primary_product_id on incident before approval.");
      return;
    }
    setSaving(`Approving "${initiative.title}"...`);
    const response = await fetch("/api/initiative/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incident_id: incidentId,
        agent_domain: initiative.domain,
        target_system: initiative.target_system ?? (initiative.domain === "rnd" ? "jira" : "manex_product_action"),
        owner_user_id: initiative.owner_hint ?? "quality_engineer",
        status: "approved",
        closure_predicate: initiative.closure_predicate,
        product_id: incident.primary_product_id,
        comments: initiative.rationale,
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
    () => new Set(report?.draft_8d.evidence ?? []),
    [report?.draft_8d.evidence],
  );

  const severityClass = sevClass(incident?.severity);
  const reportConfidence = report?.confidence ?? null;

  const phaseChips = PHASES.map((phase) => {
    const isActive = currentPhase === phase;
    const isDone = PHASES.indexOf(phase) < PHASES.indexOf(currentPhase) && currentPhase !== "idle";

    return (
      <span
        key={phase}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: "1px solid",
          borderColor: isActive ? "var(--cta)" : isDone ? "var(--line-hi)" : "var(--line)",
          background: isActive ? "var(--cta)" : isDone ? "var(--bg-inset)" : "var(--bg-surface)",
          color: isActive ? "#fff" : isDone ? "var(--ink-secondary)" : "var(--ink-muted)",
        }}
      >
        {phase}
      </span>
    );
  });

  const evidenceBadge = (id: string) => (
    <span
      key={id}
      className="chip"
      style={{
        fontFamily: "var(--mono)",
        color: "var(--cta)",
        borderColor: "rgba(99, 159, 196, 0.25)",
        background: "rgba(99, 159, 196, 0.08)",
      }}
    >
      {id.slice(0, 12)}…
    </span>
  );

  return (
    <main style={{ padding: "20px 24px", fontFamily: "var(--sans)" }}>
      <section
        className="panel"
        style={{
          padding: 20,
          marginBottom: 16,
          background: "linear-gradient(180deg, #ffffff 0%, var(--bg-subtle) 100%)",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div className="col" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <Link href="/inbox" className="btn ghost sm" style={{ textDecoration: "none" }}>
                ← Inbox
              </Link>
              <div className="eyebrow">Engineer lens · Investigate</div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-primary)" }}>
              {incident?.title ?? `Incident ${incidentId}`}
            </div>
            <div className="row muted tt" style={{ gap: 10, flexWrap: "wrap", fontSize: 12 }}>
              <span className="mono" style={{ color: "var(--ink-primary)", fontWeight: 700 }}>{incidentId}</span>
              <span>·</span>
              <span>{incident?.primary_product_id ?? "Product pending"}</span>
              <span>·</span>
              <span>{signals.length} linked signal{signals.length !== 1 ? "s" : ""}</span>
              <span>·</span>
              <span>{report ? `Report v${report.version}` : "No report yet"}</span>
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span className={`badge ${severityClass}`}>
              <span className={`sev-dot ${severityClass}`} />
              {(incident?.severity ?? "medium").toUpperCase()}
            </span>
            <span className={`status-chip ${statusClass(incident?.status)}`}>
              {incident?.status ?? "triage"}
            </span>
            {reportConfidence != null && (
              <span className={`badge ${confidenceClass(reportConfidence) === "conf-hi" ? "high" : confidenceClass(reportConfidence) === "conf-med" ? "med" : "low"}`}>
                {Math.round(reportConfidence * 100)}% confidence
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="panel" style={{ padding: 16, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => void start()}
              disabled={runStatus === "running"}
              className="btn"
              style={{
                background: runStatus === "running" ? "var(--ink-faint)" : "var(--ink-primary)",
                borderColor: runStatus === "running" ? "var(--ink-faint)" : "var(--ink-primary)",
                color: "#fff",
                fontWeight: 600,
                opacity: runStatus === "running" ? 0.7 : 1,
              }}
            >
              {runStatus === "running" ? "Investigating…" : "Investigate"}
            </button>
            <div className="eyebrow" style={{ alignSelf: "center" }}>
              {runStatus === "succeeded" ? "Report ready" : runStatus === "failed" ? "Needs retry" : "Session control"}
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{phaseChips}</div>
        </div>

        {(statusMsg || saving) && (
          <>
            <div className="divider" style={{ margin: "12px 0" }} />
            <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{saving || statusMsg}</div>
          </>
        )}

        {runStatus === "running" && liveText && (
          <div
            className="ai-block"
            style={{
              marginTop: 14,
              padding: "12px 0 0 12px",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 8 }}>Live narrative · {currentPhase}</div>
            <div
              className="card"
              style={{
                padding: 12,
                background: "var(--bg-subtle)",
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: "var(--ink-secondary)",
                  fontFamily: "var(--mono)",
                }}
              >
                {liveText}
              </pre>
            </div>
          </div>
        )}
      </section>

      <section
        className="panel"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          marginBottom: 16,
        }}
      >
        {[
          {
            label: "Linked signals",
            value: signals.length,
            delta: `${sourceChartData.length} source system${sourceChartData.length !== 1 ? "s" : ""}`,
            accent: true,
          },
          {
            label: "Phase events",
            value: phaseEvents.length,
            delta: currentPhase === "idle" ? "Awaiting run" : `Current phase · ${currentPhase}`,
          },
          {
            label: "Evidence cited",
            value: report?.draft_8d.evidence.length ?? 0,
            delta: report ? `${report.tool_calls.length} tool call${report.tool_calls.length !== 1 ? "s" : ""}` : "Report pending",
          },
          {
            label: "Report confidence",
            value: reportConfidence != null ? `${Math.round(reportConfidence * 100)}%` : "—",
            delta: report?.composed_by_model ?? "No model output yet",
          },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className="metric"
            style={{ borderRight: index < 3 ? "1px solid var(--line)" : "none" }}
          >
            <span className="label">{metric.label}</span>
            <span className={`value ${metric.accent ? "accent" : ""}`} style={{ fontSize: typeof metric.value === "number" ? 40 : 34 }}>
              {metric.value}
            </span>
            <span className="delta neu">{metric.delta}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="col" style={{ gap: 16 }}>
          <section className="panel" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <div className="eyebrow">Signal load</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: "var(--ink-primary)" }}>
                  Signal timeline
                </div>
              </div>
              <span className="chip">{timelineData.length || 0} days</span>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--ink-faint)", fontSize: 11 }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--ink-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "var(--line)",
                      boxShadow: "0 8px 24px rgba(22,0,66,0.08)",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="var(--cta)" strokeWidth={2.5} dot={{ r: 0 }} activeDot={{ r: 4, fill: "var(--cta)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {phaseEvents.length > 0 && (
            <section className="panel" style={{ padding: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Session trace</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--ink-primary)" }}>
                Phase timeline
              </div>
              <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {phaseEvents.map((ev, idx) => (
                  <li key={`${ev.seq}-${idx}`} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>
                          {new Date(ev.ts).toLocaleTimeString("en-GB")}
                        </span>
                        <span
                          className="chip"
                          style={{
                            background: ev.type === "phase_start" ? "rgba(99, 159, 196, 0.08)" : ev.type === "phase_complete" ? "rgba(95, 194, 163, 0.12)" : "var(--bg-subtle)",
                            borderColor: ev.type === "phase_start" ? "rgba(99, 159, 196, 0.25)" : ev.type === "phase_complete" ? "rgba(95, 194, 163, 0.25)" : "var(--line)",
                            color: ev.type === "phase_start" ? "var(--accent-dim)" : ev.type === "phase_complete" ? "var(--sev-low)" : "var(--ink-secondary)",
                          }}
                        >
                          {ev.type}
                        </span>
                      </div>
                      <span className="mono muted tt">#{ev.seq}</span>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: "var(--ink-secondary)",
                        fontFamily: "var(--mono)",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(ev.payload, null, 2)}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(runStatus === "succeeded" || report) && (
            <section className="panel" style={{ padding: 18 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div className="eyebrow">Report · 8D</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: "var(--ink-primary)" }}>
                    Final report
                  </div>
                </div>
                {report && (
                  <div className="row muted tt" style={{ gap: 10, flexWrap: "wrap", fontSize: 12 }}>
                    <span>v{report.version}</span>
                    <span>·</span>
                    <span>{report.composed_by_model ?? "model pending"}</span>
                    <span>·</span>
                    <span>{formatDateTime(report.composed_at)}</span>
                  </div>
                )}
              </div>

              {report ? (
                <div className="col" style={{ gap: 18 }}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="card" style={{ padding: 14 }}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>D2 · Problem</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-secondary)" }}>
                        {report.draft_8d.problem}
                      </div>
                    </div>
                    <div className="card" style={{ padding: 14 }}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>D3 · Containment</div>
                      <div className="col" style={{ gap: 8 }}>
                        {report.draft_8d.containment.map((item, idx) => (
                          <div key={`${item}-${idx}`} className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                            <span style={{ marginTop: 5, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                            <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-secondary)" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="card" style={{ padding: 14, gridColumn: "1 / -1" }}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>D4 · Likely root causes</div>
                      <div className="col" style={{ gap: 8 }}>
                        {report.draft_8d.likely_root_causes.map((item, idx) => (
                          <div key={`${item}-${idx}`} className="row" style={{ alignItems: "flex-start", gap: 8 }}>
                            <span style={{ marginTop: 5, width: 6, height: 6, borderRadius: "50%", background: "var(--sev-high)" }} />
                            <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-secondary)" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {report.draft_8d.claims && report.draft_8d.claims.length > 0 && (
                      <div className="card" style={{ padding: 14, gridColumn: "1 / -1" }}>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>Claims + evidence</div>
                        <div className="col" style={{ gap: 12 }}>
                          {report.draft_8d.claims.map((claim, idx) => (
                            <div key={`${claim.claim}-${idx}`}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)", marginBottom: 6 }}>
                                {claim.claim}
                              </div>
                              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                {claim.evidence.map(evidenceBadge)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="card" style={{ padding: 14, gridColumn: "1 / -1" }}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Evidence citations</div>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        {report.draft_8d.evidence.map(evidenceBadge)}
                      </div>
                    </div>
                  </div>

                  {report.initiatives.length > 0 && (
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Recommended actions</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--ink-primary)" }}>
                        Initiatives
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {report.initiatives.map((initiative, idx) => {
                          const confidence = Math.round(initiative.confidence * 100);
                          return (
                            <div key={`${initiative.title}-${idx}`} className="card" style={{ padding: 16 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, color: "var(--ink-primary)" }}>
                                {initiative.title}
                              </div>
                              <div className="eyebrow" style={{ marginTop: 8 }}>{initiative.domain}</div>
                              <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--ink-secondary)" }}>
                                {initiative.rationale}
                              </div>
                              <div className="row" style={{ justifyContent: "space-between", marginTop: 14, alignItems: "flex-start", gap: 12 }}>
                                <span className={confidenceClass(initiative.confidence)}>
                                  {confidence}% confidence
                                </span>
                                <span className="muted tt" style={{ fontSize: 12 }}>
                                  {initiative.evidence.length} evidence item{initiative.evidence.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              {initiative.owner_hint && (
                                <div className="muted tt" style={{ fontSize: 12, marginTop: 8 }}>
                                  Owner: {initiative.owner_hint}
                                </div>
                              )}
                              <button
                                onClick={() => void approve(initiative)}
                                className="btn"
                                style={{
                                  width: "100%",
                                  justifyContent: "center",
                                  marginTop: 14,
                                  background: "var(--ink-primary)",
                                  borderColor: "var(--ink-primary)",
                                  color: "#fff",
                                  fontWeight: 600,
                                }}
                              >
                                Approve
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  {runStatus === "running" ? "Report generating…" : "Report will appear here after investigation completes."}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="col" style={{ gap: 16 }}>
          <section className="panel" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Signal composition</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--ink-primary)" }}>
              Sources
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceChartData}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="source" hide />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--ink-faint)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "var(--line)",
                      boxShadow: "0 8px 24px rgba(22,0,66,0.08)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--ink-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="col" style={{ gap: 8, marginTop: 12 }}>
              {sourceChartData.length > 0 ? (
                sourceChartData.map((row) => (
                  <div key={row.source} className="row" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--ink-secondary)" }}>
                    <span>{row.source}</span>
                    <span className="mono">{row.count}</span>
                  </div>
                ))
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>No source distribution yet.</div>
              )}
            </div>
          </section>

          <section className="panel" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Raw context</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--ink-primary)" }}>
              Signals
            </div>
            <div className="col" style={{ gap: 8, maxHeight: 520, overflow: "auto" }}>
              {signals.length > 0 ? (
                signals.map((signal) => (
                  <div key={signal.signal_id} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>
                        {signal.signal_type}
                      </div>
                      <span className="mono muted tt" style={{ fontSize: 10 }}>
                        {signal.signal_id}
                      </span>
                    </div>
                    <div className="muted tt" style={{ fontSize: 12, marginTop: 6 }}>
                      {signal.source_system} · {formatDateTime(signal.captured_ts)}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: "var(--ink-secondary)" }}>
                      {signal.text_payload ?? "No text payload."}
                    </div>
                  </div>
                ))
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>No linked signals yet.</div>
              )}
            </div>
          </section>

          <section className="panel" style={{ padding: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Provenance</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "var(--ink-primary)" }}>
              Evidence trace
            </div>
            {report && report.tool_calls.length > 0 ? (
              <div className="col" style={{ gap: 8 }}>
                {report.tool_calls.map((call) => (
                  <div key={call.tool_call_id} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>
                        {call.tool}
                      </div>
                      <span className="mono muted tt" style={{ fontSize: 10 }}>
                        {call.tool_call_id}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: "var(--ink-secondary)" }}>
                      {call.summary}
                    </div>
                    <div className="tt" style={{ marginTop: 8, color: citedEvidence.has(call.tool_call_id) ? "var(--cta)" : "var(--ink-muted)", fontSize: 12 }}>
                      {citedEvidence.has(call.tool_call_id) ? "Cited in final report." : "Not cited in final report."}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12 }}>
                {runStatus === "running" ? "Evidence gathering…" : "No evidence yet."}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
