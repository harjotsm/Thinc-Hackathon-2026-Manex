"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PROTOTYPE_DATA, SIGNAL_TO_HYPOTHESIS } from "@/lib/prototype-data";

type GraphVariant = "radial" | "tree" | "stack";

function iconGlyph(name: string) {
  switch (name) {
    case "mail":
      return "✉";
    case "truck":
      return "⇥";
    case "chart":
      return "◔";
    case "trend":
      return "≈";
    case "mic":
      return "◉";
    case "factory":
      return "⌂";
    case "users":
      return "◌";
    case "flow":
      return "↳";
    case "flask":
      return "⚗";
    case "box":
      return "□";
    default:
      return "•";
  }
}

function GraphTabs({
  value,
  onChange,
}: {
  value: GraphVariant;
  onChange: (next: GraphVariant) => void;
}) {
  return (
    <div className="var-tabs">
      {([
        { id: "radial", label: "Radial" },
        { id: "tree", label: "Tree" },
        { id: "stack", label: "Stack" },
      ] as const).map((item) => (
        <button key={item.id} type="button" className={value === item.id ? "on" : ""} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function InlineHypNode({
  hypothesis,
  active,
  onClick,
}: {
  hypothesis: (typeof PROTOTYPE_DATA.incident.hypotheses)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-elevated)",
        border: active
          ? "1.5px solid var(--accent)"
          : hypothesis.speculation
            ? "1.5px dashed var(--line-strong)"
            : "1.5px solid var(--line-hi)",
        borderRadius: 10,
        padding: "9px 11px",
        boxShadow: active ? "0 0 0 4px rgba(99,159,196,0.18), 0 0 30px rgba(99,159,196,0.20)" : "none",
        cursor: "pointer",
        transition: "all 200ms",
        overflow: "hidden",
      }}
    >
      <div className="eyebrow" style={{ color: active ? "var(--accent)" : "var(--ink-muted)" }}>
        {hypothesis.label}
      </div>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          margin: "3px 0 7px",
          lineHeight: 1.3,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {hypothesis.title}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: 1, height: 5, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${hypothesis.conf}%`, height: "100%", background: active ? "var(--accent)" : "var(--ink-muted)" }} />
        </div>
        <span
          className="mono tt"
          style={{ color: active ? "var(--accent)" : "var(--ink-secondary)", fontWeight: 600 }}
        >
          {hypothesis.conf}%
        </span>
      </div>
      <div className="row muted tt" style={{ marginTop: 5, justifyContent: "space-between", whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>✓{hypothesis.evidence} · ✗{hypothesis.contradict}</span>
        {hypothesis.primary && <span style={{ color: "var(--accent)", flexShrink: 0, marginLeft: 6 }}>primary</span>}
      </div>
    </div>
  );
}

function GraphRadial({
  active,
  setActive,
}: {
  active: string;
  setActive: (next: string) => void;
}) {
  const hypotheses = PROTOTYPE_DATA.incident.hypotheses;
  const left = hypotheses.slice(0, 2);
  const right = hypotheses.slice(2);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 410,
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 130px minmax(0,1fr)",
        gridTemplateRows: "auto auto",
        gap: "14px 18px",
        alignContent: "center",
        justifyContent: "center",
        padding: "20px 8px",
      }}
    >
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <line x1="38" y1="30" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
        <line x1="38" y1="70" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
        <line x1="62" y1="30" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
        <line x1="62" y1="70" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25" />
      </svg>

      {left.map((hypothesis, index) => (
        <div key={hypothesis.id} style={{ gridColumn: 1, gridRow: index + 1, justifySelf: "end", width: "100%", maxWidth: 220, zIndex: 1 }}>
          <InlineHypNode hypothesis={hypothesis} active={hypothesis.id === active} onClick={() => setActive(hypothesis.id)} />
        </div>
      ))}

      <div style={{ gridColumn: 2, gridRow: "1 / span 2", justifySelf: "center", alignSelf: "center", width: 120, height: 86, zIndex: 1 }}>
        <div
          className="ring-accent"
          style={{
            width: "100%",
            height: "100%",
            background: "var(--bg-elevated)",
            border: "1.5px solid var(--accent)",
            borderRadius: 10,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div className="eyebrow" style={{ color: "var(--accent)", fontSize: 9 }}>
            Incident
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginTop: 3 }}>
            {PROTOTYPE_DATA.incident.id.replace("-", "-\n")}
          </div>
          <div className="muted tt mono" style={{ marginTop: 2 }}>
            {PROTOTYPE_DATA.incident.signals.length} signals
          </div>
        </div>
      </div>

      {right.map((hypothesis, index) => (
        <div key={hypothesis.id} style={{ gridColumn: 3, gridRow: index + 1, justifySelf: "start", width: "100%", maxWidth: 220, zIndex: 1 }}>
          <InlineHypNode hypothesis={hypothesis} active={hypothesis.id === active} onClick={() => setActive(hypothesis.id)} />
        </div>
      ))}

      <div
        className="muted mono"
        style={{
          position: "absolute",
          bottom: 2,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          maxWidth: "90%",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        → 5 evidence: SIG-408, SIG-399, SIG-387, SIG-411, SIG-412
      </div>
    </div>
  );
}

function GraphTree({
  active,
  setActive,
}: {
  active: string;
  setActive: (next: string) => void;
}) {
  const hypotheses = PROTOTYPE_DATA.incident.hypotheses;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 520,
        display: "grid",
        gridTemplateColumns: "180px 80px minmax(0,1fr)",
        gridTemplateRows: `repeat(${hypotheses.length}, minmax(90px, 1fr))`,
        alignItems: "center",
        gap: "14px 0",
        padding: "20px 8px",
      }}
    >
      <svg
        style={{ gridColumn: 2, gridRow: `1 / span ${hypotheses.length}`, width: "100%", height: "100%", alignSelf: "stretch", pointerEvents: "none" }}
        preserveAspectRatio="none"
        viewBox="0 0 80 100"
      >
        {hypotheses.map((_, index) => {
          const y = ((index + 0.5) / hypotheses.length) * 100;
          return (
            <path
              key={index}
              d={`M 0 50 C 40 50, 40 ${y}, 80 ${y}`}
              fill="none"
              stroke="rgba(99,159,196,0.5)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div style={{ gridColumn: 1, gridRow: `1 / span ${hypotheses.length}`, justifySelf: "end", alignSelf: "center", width: 170, zIndex: 1 }}>
        <div className="ring-accent" style={{ width: "100%", background: "var(--bg-elevated)", border: "1.5px solid var(--accent)", borderRadius: 10, padding: 12 }}>
          <div className="eyebrow" style={{ color: "var(--accent)" }}>
            Incident · root
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, marginTop: 4 }}>
            {PROTOTYPE_DATA.incident.title.split("—")[0].trim()}
          </div>
          <div className="muted tt mono" style={{ marginTop: 4 }}>
            {PROTOTYPE_DATA.incident.id}
          </div>
          <div className="muted tt" style={{ marginTop: 2 }}>
            {PROTOTYPE_DATA.incident.signals.length} signals · {hypotheses.length} hypotheses
          </div>
        </div>
      </div>

      {hypotheses.map((hypothesis, index) => (
        <div key={hypothesis.id} style={{ gridColumn: 3, gridRow: index + 1, minWidth: 0, paddingLeft: 4, zIndex: 1 }}>
          <InlineHypNode hypothesis={hypothesis} active={hypothesis.id === active} onClick={() => setActive(hypothesis.id)} />
        </div>
      ))}
    </div>
  );
}

function GraphStack({
  active,
  setActive,
}: {
  active: string;
  setActive: (next: string) => void;
}) {
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="card ring-accent" style={{ padding: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--accent)" }}>
              Incident · root
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{PROTOTYPE_DATA.incident.title}</div>
          </div>
          <span className="chip sev-high">high</span>
        </div>
        <div className="muted tt mono" style={{ marginTop: 6 }}>
          {PROTOTYPE_DATA.incident.id} · {PROTOTYPE_DATA.incident.signals.length} signals · opened {PROTOTYPE_DATA.incident.opened}
        </div>
      </div>
      {PROTOTYPE_DATA.incident.hypotheses.map((hypothesis) => (
        <div
          key={hypothesis.id}
          onClick={() => setActive(hypothesis.id)}
          className="card"
          style={{
            padding: 12,
            marginLeft: 24,
            cursor: "pointer",
            border: hypothesis.id === active ? "1.5px solid var(--accent)" : hypothesis.speculation ? "1.5px dashed var(--line-strong)" : "1px solid var(--line)",
            boxShadow: hypothesis.id === active ? "0 0 0 4px rgba(99,159,196,0.12)" : "none",
          }}
        >
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, gap: 10, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="eyebrow" style={{ color: hypothesis.id === active ? "var(--accent)" : "var(--ink-muted)", marginBottom: 3 }}>
                {hypothesis.label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, overflowWrap: "anywhere" }}>{hypothesis.title}</div>
            </div>
            <span className="mono tt" style={{ color: hypothesis.id === active ? "var(--accent)" : "var(--ink-secondary)", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
              {hypothesis.conf}%
            </span>
          </div>
          <div style={{ height: 5, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${hypothesis.conf}%`, height: "100%", background: hypothesis.id === active ? "var(--accent)" : "var(--ink-muted)" }} />
          </div>
          <div className="row muted tt" style={{ marginTop: 6, gap: 12 }}>
            <span>✓ {hypothesis.evidence} evidence</span>
            <span>✗ {hypothesis.contradict} contradict</span>
            {hypothesis.primary && <span style={{ color: "var(--accent)" }}>· primary</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline() {
  const sigs = PROTOTYPE_DATA.incident.signals;
  const positions = [94, 88, 82, 72, 58, 30, 28, 12];
  const colorFor = (src: string) =>
    ({
      Warranty: "var(--viz-4)",
      "EOL-Test": "var(--viz-2)",
      "SPC-Drift": "var(--viz-3)",
      "Inbound-Inspection": "var(--viz-5)",
      Voice: "var(--accent)",
      Social: "var(--ink-muted)",
    })[src] ?? "var(--ink-muted)";

  return (
    <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg-subtle)", padding: "10px 16px" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 10, flexShrink: 0 }}>
          <span className="eyebrow">Timeline</span>
          <span className="muted tt">48h window · click to focus</span>
        </div>
        <div className="row muted" style={{ gap: 8, fontSize: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {["Warranty", "EOL-Test", "SPC-Drift", "Inbound", "Voice", "Social"].map((key) => (
            <span key={key} className="row" style={{ gap: 3, color: "var(--ink-muted)", fontSize: 10, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: colorFor(key === "Inbound" ? "Inbound-Inspection" : key) }} />
              {key}
            </span>
          ))}
        </div>
      </div>
      <div style={{ position: "relative", height: 60, background: "var(--bg-inset)", borderRadius: 6 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((position) => (
          <div key={position} style={{ position: "absolute", left: `${position * 100}%`, top: 0, bottom: 0, width: 1, background: "var(--line)" }} />
        ))}
        <div style={{ position: "absolute", left: "22%", top: 0, bottom: 0, width: 2, background: "var(--viz-3)", opacity: 0.5 }} />
        <div className="mono" style={{ position: "absolute", left: "22%", top: -14, fontSize: 9, color: "var(--viz-3)" }}>BUILD</div>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 2, background: "var(--accent)" }} />
        <div className="mono" style={{ position: "absolute", right: 0, top: -14, fontSize: 9, color: "var(--accent)" }}>NOW · 14:42</div>

        {sigs.map((signal, index) => (
          <div
            key={signal.id}
            title={`${signal.id} — ${signal.text}`}
            style={{
              position: "absolute",
              left: `${positions[index] ?? 50}%`,
              top: 15 + (index % 3) * 10,
              width: 10,
              height: 10,
              borderRadius: 5,
              background: colorFor(signal.src),
              border: "1.5px solid var(--bg-inset)",
              transform: "translateX(-50%)",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
        <span className="muted tt mono">-48h</span>
        <span className="muted tt mono">-24h</span>
        <span className="muted tt mono">-12h</span>
        <span className="muted tt mono">now</span>
      </div>
    </div>
  );
}

export function IncidentCanvasScreen({ incidentId }: { incidentId: string }) {
  const [variant, setVariant] = useState<GraphVariant>("radial");
  const [active, setActive] = useState("HYP-material");
  const [focusedSignal, setFocusedSignal] = useState<string | null>(null);
  const inc = PROTOTYPE_DATA.incident;
  const Graph = useMemo(() => ({ radial: GraphRadial, tree: GraphTree, stack: GraphStack }[variant]), [variant]);

  return (
    <main style={{ position: "relative", height: "calc(100vh - 52px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-surface)", minWidth: 0 }}>
        <Link href="/inbox" className="btn ghost sm" style={{ flexShrink: 0, textDecoration: "none" }}>
          ← Back
        </Link>
        <span className="sev-dot high" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: "0 1 360px", overflow: "hidden" }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {inc.title}
          </div>
          <div className="muted tt mono" style={{ marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {incidentId} · opened {inc.opened} · {inc.signals.length} signals · assignee {PROTOTYPE_DATA.user.initials}
          </div>
        </div>
        <span className="chip sev-high" style={{ flexShrink: 0 }}>high</span>
        <div className="spacer" />
        <div className="lens-switch" style={{ flexShrink: 0 }}>
          <button className="on" type="button">Canvas</button>
          <Link href={`/incident/${incidentId}/8d`} className="btn ghost sm" style={{ textDecoration: "none" }}>8D</Link>
          <button type="button">FMEA</button>
          <button type="button">Ishikawa</button>
          <button type="button">Timeline</button>
        </div>
        <GraphTabs value={variant} onChange={setVariant} />
        <Link href={`/incident/${incidentId}/resolve`} className="btn primary sm" style={{ textDecoration: "none", flexShrink: 0 }}>
          Dispatch →
        </Link>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr 360px", minHeight: 0 }}>
        <div style={{ borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Signals</span>
                <span className="chip">{inc.signals.length}</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn ghost sm" type="button">All</button>
                <button className="btn ghost sm" type="button">Internal</button>
                <button className="btn ghost sm" type="button">External</button>
              </div>
            </div>
          </div>
          <div style={{ overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            {inc.signals.map((signal) => {
              const hyp = SIGNAL_TO_HYPOTHESIS[signal.id];
              const focused = focusedSignal === signal.id;
              return (
                <div
                  key={signal.id}
                  className="card"
                  onClick={() => {
                    setFocusedSignal(signal.id);
                    if (hyp) setActive(hyp);
                  }}
                  style={{
                    padding: 10,
                    cursor: "pointer",
                    borderColor: focused ? "var(--accent-ring)" : "var(--line)",
                    boxShadow: focused ? "0 0 0 2px var(--accent-ring), 0 4px 16px rgba(99,159,196,0.18)" : "none",
                    background: focused ? "var(--accent-bg)" : "var(--bg-surface)",
                    transition: "all 180ms",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                    <div className="row" style={{ gap: 6, color: "var(--ink-secondary)", fontSize: 11, minWidth: 0, flex: 1, overflow: "hidden" }}>
                      <span style={{ color: "var(--ink-muted)", flexShrink: 0 }}>{iconGlyph(signal.srcIcon)}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signal.src}</span>
                      <span className="muted" style={{ flexShrink: 0 }}>·</span>
                      <span className="muted" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{signal.time}</span>
                    </div>
                    <span className={`sev-dot ${signal.sev}`} />
                  </div>
                  <div style={{ fontSize: 12, margin: "6px 0 4px", lineHeight: 1.4, overflowWrap: "anywhere" }}>{signal.text}</div>
                  <div className="mono muted" style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{signal.ref}</div>
                  <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                    <span className="mono muted" style={{ fontSize: 10 }}>{signal.id}</span>
                    {hyp ? <span className="tt" style={{ color: "var(--accent)", fontWeight: 600 }}>→ graph</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hex-bg" style={{ display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            <Graph active={active} setActive={setActive} />
          </div>
          <Timeline />
        </div>

        <div style={{ borderLeft: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Stakeholder contributions</span>
              <div className="row" style={{ gap: 6 }}>
                <span className="chip">{inc.contributions.length}</span>
                <span className="muted">•</span>
              </div>
            </div>
          </div>
          <div style={{ overflow: "auto", padding: 12, flex: 1 }}>
            {inc.contributions.map((contribution) => {
              const color =
                contribution.status === "live"
                  ? "var(--accent)"
                  : contribution.status === "contributed"
                    ? "var(--sev-low)"
                    : "var(--ink-muted)";
              const label = {
                live: "Live",
                contributed: "Contributed",
                pending: "Pending",
                dismissed: "Dismissed",
              }[contribution.status];
              return (
                <div
                  key={contribution.domain}
                  className="card"
                  style={{
                    padding: 10,
                    marginBottom: 8,
                    opacity: contribution.status === "dismissed" ? 0.45 : 1,
                    textDecoration: contribution.status === "dismissed" ? "line-through" : "none",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <div className="row" style={{ gap: 8, minWidth: 0, flex: 1 }}>
                      <span style={{ color: "var(--ink-muted)", flexShrink: 0 }}>{iconGlyph(contribution.icon)}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {contribution.domain}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: color, animation: contribution.status === "live" ? "pulse 1.5s infinite" : "none" }} />
                      <span className="muted tt mono">{label}</span>
                    </div>
                  </div>
                  {contribution.text ? (
                    <div className="ai-marked" style={{ fontSize: 11, color: "var(--ink-secondary)", marginTop: 8, lineHeight: 1.4, overflowWrap: "anywhere" }}>
                      {(contribution.status === "live" || contribution.status === "contributed") && <span className="ai-spark">✦</span>}
                      {contribution.text}
                    </div>
                  ) : null}
                </div>
              );
            })}

            <div className="divider" />
            <div className="eyebrow" style={{ marginBottom: 8 }}>AI reasoning · v3</div>
            <div className="ai-marked" style={{ fontSize: 12, color: "var(--ink-secondary)", lineHeight: 1.5 }}>
              <div style={{ color: "var(--ink-primary)", marginBottom: 6 }}>
                <span className="ai-spark">✦</span>Problem statement
              </div>
              A cluster of 17 signals across warranty, inbound inspection, SPC, and EOL near-miss channels point at
              <span style={{ color: "var(--accent)" }}> R33</span> mounting failures on power modules built between
              2026-03-28 and 2026-04-12. The common factor is supplier batch
              <span className="mono"> SB-00007</span> from ElektroParts, whose ESR readings
              <span className="mono"> 0.28Ω mean</span> exceed the acceptance limit of
              <span className="mono"> 0.22Ω</span>. Hypotheses ranked by fit to data; <b>Material</b> leads at 82%
              confidence with 5 pieces of supporting evidence and zero contradicting findings.
            </div>
            <div className="row" style={{ gap: 6, marginTop: 10 }}>
              <button className="btn ghost sm" type="button">Regenerate</button>
              <button className="btn sm" type="button">Ground on more data</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function IncidentEightDScreen({ incidentId }: { incidentId: string }) {
  const [variant, setVariant] = useState<"doc" | "split">("doc");
  const sections = [
    { d: "D1", title: "Team", content: "M. Bauer (PQ Lead), J. Keller (Supplier Q), S. Müller (R&D), T. Roth (Logistics), L. Ahmed (CX).", src: ["CTR-01", "CTR-08"] },
    { d: "D2", title: "Problem description", content: "Power Module PM-00008 field failures clustered on units built with supplier batch SB-00007. Symptom: intermittent shutdown under load, with thermal signature. 17 signals correlated across warranty, inbound inspection, SPC, and EOL near-miss data.", ai: true, src: ["SIG-412", "SIG-411", "SIG-408", "SIG-399", "SIG-387"] },
    { d: "D3", title: "Interim containment", content: "Quarantine affected serials at Werk München Linie 1. Insert 100% ESR inspection at Stn-04 until batch SB-00007 exhaustion.", ai: true, src: ["INI-091", "SIG-408"] },
    { d: "D4", title: "Root cause", content: "ElektroParts batch SB-00007 R33 parts show ESR mean 0.28Ω vs spec ≤0.22Ω. Elevated ESR under sustained load produces thermal rise exceeding R33 footprint margin, resulting in premature cold-solder separation.", ai: true, src: ["SIG-408", "CTR-01", "CTR-04"] },
    { d: "D5", title: "Chosen corrective action", content: "Supplier 8D to ElektroParts for batch traceability + process review. R&D spec revision to require ESR tolerance check at acceptance. Production quarantine + inspection step. Proactive customer outreach on 340 at-risk serials.", ai: true, src: ["INI-091", "INI-092", "INI-093", "INI-094"] },
    { d: "D6", title: "Implement & verify", content: "Initiatives INI-091…095 dispatched to MES, SRM, Jira, ERP, CRM. Verification: 72h SPC + 4-week warranty accrual review.", src: ["INI-091", "INI-095"] },
    { d: "D7", title: "Prevent recurrence", content: "FMEA update on R33 material grade; inbound ESR screen now baseline for supplier ElektroParts; lesson LES-018 applied.", ai: true, src: ["LES-018", "CTR-04"] },
    { d: "D8", title: "Close-out", content: "Team recognized in quarterly QRB. Lesson filed to network library.", src: [] },
  ];

  return (
    <main style={{ height: "calc(100vh - 52px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-surface)" }}>
        <Link href={`/incident/${incidentId}`} className="btn ghost sm" style={{ textDecoration: "none" }}>
          ← Canvas
        </Link>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>8D Report — {incidentId}</div>
          <div className="muted tt mono">v3 · auto-drafted 2 min ago · every section sourced</div>
        </div>
        <div className="spacer" />
        <button className="btn ghost sm" type="button">Re-draft from canvas</button>
        <button className="btn ghost sm" type="button">Revision history ▾</button>
        <button className="btn sm" type="button">Export PDF</button>
        <div className="var-tabs">
          {(["doc", "split"] as const).map((item) => (
            <button key={item} type="button" className={variant === item ? "on" : ""} onClick={() => setVariant(item)}>
              {item === "doc" ? "Document" : "Split"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px 0" }}>
        <div
          style={{
            maxWidth: variant === "doc" ? 860 : 1200,
            margin: "0 auto",
            display: variant === "split" ? "grid" : "block",
            gridTemplateColumns: variant === "split" ? "1fr 300px" : undefined,
            gap: 20,
            padding: "0 24px",
          }}
        >
          <div>
            <div className="panel" style={{ padding: 20, marginBottom: 16 }}>
              <div className="eyebrow">Report · 8D</div>
              <div style={{ fontSize: 22, fontWeight: 600, margin: "6px 0" }}>{PROTOTYPE_DATA.incident.title}</div>
              <div className="muted tt mono">
                {incidentId} · {PROTOTYPE_DATA.incident.product} · {PROTOTYPE_DATA.incident.supplier} · batch {PROTOTYPE_DATA.incident.batch} · opened 2026-04-18 14:25
              </div>
            </div>

            {sections.map((section) => (
              <div key={section.d} className={section.ai ? "card ai-marked" : "card"} style={{ padding: 16, marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.08em" }}>{section.d}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{section.title}</span>
                    {section.ai ? (
                      <span className="chip" style={{ background: "var(--accent-bg)", color: "var(--accent)", borderColor: "var(--accent-ring)" }}>
                        <span className="ai-spark">✦</span>AI-drafted
                      </span>
                    ) : null}
                  </div>
                  <button className="btn ghost sm" type="button">Override</button>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-secondary)", lineHeight: 1.55 }}>{section.content}</div>
                {section.src.length > 0 ? (
                  <div className="muted mono" style={{ fontSize: 10, marginTop: 10, letterSpacing: "0.04em" }}>
                    Sourced from: {section.src.join(", ")}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {variant === "split" ? (
            <aside style={{ position: "sticky", top: 0, alignSelf: "flex-start" }}>
              <div className="panel" style={{ padding: 14 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Provenance map</div>
                <div style={{ fontSize: 11, color: "var(--ink-secondary)", lineHeight: 1.6 }}>
                  <div style={{ marginBottom: 10 }}>
                    <div className="muted">Signals</div>
                    <div className="mono">SIG-412 · SIG-411 · SIG-408 · SIG-399 · SIG-387 · SIG-361</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div className="muted">Contributions</div>
                    <div className="mono">CTR-01 · CTR-04 · CTR-08</div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div className="muted">Initiatives</div>
                    <div className="mono">INI-091 · INI-092 · INI-093 · INI-094 · INI-095</div>
                  </div>
                  <div>
                    <div className="muted">Lessons applied</div>
                    <div className="mono">LES-018</div>
                  </div>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export function IncidentResolveScreen({ incidentId }: { incidentId: string }) {
  const [included, setIncluded] = useState<Record<string, boolean>>(
    Object.fromEntries(PROTOTYPE_DATA.agents.map((agent) => [agent.id, true])),
  );
  const enabledCount = Object.values(included).filter(Boolean).length;

  const totals = useMemo(() => {
    const contribs = {
      "A-prod": { claims: 8, eurMin: 22, eurMax: 38 },
      "A-sup": { claims: 0, eurMin: 12, eurMax: 24 },
      "A-rd": { claims: 0, eurMin: 6, eurMax: 14 },
      "A-log": { claims: 0, eurMin: 4, eurMax: 8 },
      "A-cust": { claims: 3, eurMin: 4, eurMax: 8 },
    } as const;

    return Object.entries(included).reduce(
      (acc, [id, on]) => {
        if (!on) return acc;
        const contrib = contribs[id as keyof typeof contribs];
        return {
          claims: acc.claims + contrib.claims,
          eurMin: acc.eurMin + contrib.eurMin,
          eurMax: acc.eurMax + contrib.eurMax,
        };
      },
      { claims: 0, eurMin: 0, eurMax: 0 },
    );
  }, [included]);

  const pctReduction = Math.min(95, Math.round(totals.eurMax));

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-surface)" }}>
        <Link href={`/incident/${incidentId}`} className="btn ghost sm" style={{ textDecoration: "none" }}>
          ← Canvas
        </Link>
        <span className="sev-dot high" />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Resolve · {incidentId}</div>
          <div className="muted tt mono">{PROTOTYPE_DATA.incident.title}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 440px", minHeight: 0, overflow: "hidden" }}>
        <div style={{ overflow: "auto", padding: 18, position: "relative" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Act III · Resolve</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>5 domain agents, 5 initiatives</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PROTOTYPE_DATA.agents.map((agent) => (
              <div
                key={agent.id}
                className="card ai-marked"
                style={{
                  padding: 14,
                  position: "relative",
                  borderColor: included[agent.id] ? "var(--line-hi)" : "var(--line)",
                  opacity: included[agent.id] ? 1 : 0.55,
                }}
              >
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, alignItems: "flex-start", gap: 12 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "var(--bg-elevated)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                      }}
                    >
                      {iconGlyph(agent.icon)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        <span className="ai-spark">✦</span>{agent.name}
                      </div>
                      <div className="muted tt mono">→ posts to {agent.target}</div>
                    </div>
                  </div>
                  <label className="row" style={{ gap: 6, fontSize: 11 }}>
                    <input
                      type="checkbox"
                      checked={included[agent.id]}
                      onChange={(event) => setIncluded((current) => ({ ...current, [agent.id]: event.target.checked }))}
                    />
                    <span className="muted">Include</span>
                  </label>
                </div>

                <div
                  style={{
                    background: "var(--bg-inset)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 12,
                    lineHeight: 1.5,
                    borderLeft: "2px solid var(--accent)",
                  }}
                >
                  {agent.draft}
                </div>

                <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="muted tt">Owner</span>
                    <span className="chip">{agent.owner}</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="muted tt">Due</span>
                    <span className="chip">{agent.due}</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="muted tt">Priority</span>
                    <span className="chip">{agent.priority}</span>
                  </div>
                  <div className="spacer" />
                  <span className="chip" style={{ color: "var(--accent)", borderColor: "var(--accent-ring)", background: "var(--accent-bg)" }}>
                    {agent.impact}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderLeft: "1px solid var(--line)",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #f4faff 0%, #fff 30%)",
          }}
        >
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              padding: "20px 18px 16px",
              background: "linear-gradient(180deg, var(--accent-bg) 0%, #f4faff 100%)",
              borderBottom: "1px solid var(--accent-ring)",
            }}
          >
            <div className="eyebrow" style={{ color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>
              <span className="ai-spark">✦</span>Impact Simulator · live
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginBottom: 14, lineHeight: 1.4 }}>
              Updates as you toggle agents below.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div className="label muted" style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>Claims avoided</div>
                <div style={{ fontSize: 42, fontWeight: 700, color: "var(--cta)", letterSpacing: "-0.02em", lineHeight: 1, marginTop: 2 }}>
                  {totals.claims}
                </div>
                <div className="muted tt" style={{ marginTop: 4 }}>over 12 weeks · ±2</div>
              </div>
              <div>
                <div className="label muted" style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>€ avoided</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--cta)", letterSpacing: "-0.01em", lineHeight: 1, marginTop: 6 }}>
                  €{totals.eurMin}–{totals.eurMax}k
                </div>
                <div className="muted tt" style={{ marginTop: 4 }}>{pctReduction}% reduction</div>
              </div>
            </div>

            <div style={{ padding: "10px 12px", background: "#fff", border: "1px solid var(--line)", borderRadius: 8 }}>
              <div className="muted tt" style={{ marginBottom: 6, fontWeight: 600 }}>12-week exposure</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, width: 60, color: "var(--ink-muted)" }}>No action</span>
                <div style={{ flex: 1, height: 8, background: "var(--bg-inset)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: "100%", height: "100%", background: "var(--sev-crit)" }} />
                </div>
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, width: 42, textAlign: "right", color: "var(--sev-crit)" }}>€100k</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, width: 60, color: "var(--accent)" }}>Dispatch {enabledCount}</span>
                <div style={{ flex: 1, height: 8, background: "var(--bg-inset)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(8, 100 - pctReduction)}%`, height: "100%", background: "var(--cta)", transition: "width 250ms" }} />
                </div>
                <span className="mono" style={{ fontSize: 10, fontWeight: 600, width: 42, textAlign: "right", color: "var(--cta)" }}>
                  €{Math.max(8, 100 - totals.eurMax)}k
                </span>
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 18px", flex: 1, overflow: "auto" }}>
            <div className="eyebrow" style={{ margin: "0 0 8px" }}>Similar past incidents</div>
            {PROTOTYPE_DATA.lessons.slice(0, 3).map((lesson) => (
              <div key={lesson.id} className="card" style={{ padding: 10, marginBottom: 8 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="mono muted tt">{lesson.id}</span>
                  <span className="chip sev-low">resolved</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, margin: "4px 0" }}>{lesson.sig}</div>
                <div className="muted tt">Applied {lesson.applied}× · {lesson.plants} plants</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--line)", background: "var(--bg-surface)", display: "flex", alignItems: "center", gap: 14 }}>
        <div className="muted tt">{enabledCount} of 5 agents included · all have owner + due date</div>
        <div className="spacer" />
        <button className="btn ghost sm" type="button">Save draft</button>
        <button className="btn primary" type="button" style={{ padding: "8px 18px" }}>
          Dispatch {enabledCount} initiatives →
        </button>
      </div>
    </main>
  );
}
