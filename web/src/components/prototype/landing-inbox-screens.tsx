"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PROTOTYPE_DATA } from "@/lib/prototype-data";

function Spark({
  data,
  color = "var(--accent)",
  fill = false,
  height = 22,
}: {
  data: number[];
  color?: string;
  fill?: boolean;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 90 - 5}`);
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }}>
      {fill ? <polygon fill={color} opacity="0.18" points={`0,100 ${pts.join(" ")} 100,100`} /> : null}
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts.join(" ")} />
    </svg>
  );
}

function confidenceClass(confidence: number) {
  if (confidence >= 80) return "conf-hi";
  if (confidence >= 50) return "conf-med";
  return "conf-lo";
}

export function PrototypeLandingScreen() {
  const [variant, setVariant] = useState<"split" | "feed" | "compact">("split");
  const [landingReady, setLandingReady] = useState(false);
  const firstName = PROTOTYPE_DATA.user.name.split(". ").at(1) ?? PROTOTYPE_DATA.user.name;

  useEffect(() => {
    const saved = window.localStorage.getItem("landing.var");
    if (saved === "split" || saved === "feed" || saved === "compact") {
      setVariant(saved);
    }
    setLandingReady(true);
  }, []);

  useEffect(() => {
    if (!landingReady) return;
    window.localStorage.setItem("landing.var", variant);
  }, [landingReady, variant]);

  return (
    <main style={{ padding: "20px 24px" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Engineer lens · {PROTOTYPE_DATA.now} · {PROTOTYPE_DATA.shift}</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600, whiteSpace: "nowrap" }}>Good afternoon, {firstName}.</h1>
        </div>
        <div className="var-tabs">
          {([
            { id: "split", label: "Split" },
            { id: "feed", label: "Feed" },
            { id: "compact", label: "Compact" },
          ] as const).map((item) => (
            <button key={item.id} type="button" className={variant === item.id ? "on" : ""} onClick={() => setVariant(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", marginBottom: 16 }}>
        <div className="metric" style={{ borderRight: "1px solid var(--line)", padding: "22px 20px" }}>
          <span className="label">New incidents today</span>
          <span className="value accent" style={{ fontSize: 52, lineHeight: 1 }}>{PROTOTYPE_DATA.counts.openIncidents}</span>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="delta bad">↑ 3 vs yesterday</span>
            <Spark data={[1, 3, 2, 5, 7, 6, 4]} color="var(--cta)" fill height={28} />
          </div>
        </div>
        {[
          { label: "Open initiatives", value: PROTOTYPE_DATA.counts.activeInitiatives, delta: "avg age 3.4d", cls: "neu", data: [2, 2, 3, 4, 5, 5, 6] },
          { label: "€ cost at risk", value: PROTOTYPE_DATA.counts.costAtRisk, delta: "↑ 12% vs 7d", cls: "bad", data: [2, 3, 3, 5, 4, 6, 7] },
          { label: "Lessons applied", value: PROTOTYPE_DATA.counts.lessonsApplied, delta: "↑ 2 this week", cls: "good", data: [1, 2, 2, 3, 4, 4, 5] },
        ].map((item, index) => (
          <div key={item.label} className="metric" style={{ borderRight: index < 2 ? "1px solid var(--line)" : "none" }}>
            <span className="label">{item.label}</span>
            <span className="value">{item.value}</span>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className={`delta ${item.cls}`}>{item.delta}</span>
              <Spark data={item.data} color="var(--ink-muted)" height={20} />
            </div>
          </div>
        ))}
      </div>

      {variant === "split" ? (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <div className="panel" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Needs your attention</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>Ranked by severity × cost × confidence</div>
              </div>
              <Link href="/inbox" className="btn ghost sm" style={{ textDecoration: "none" }}>Show all 14</Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PROTOTYPE_DATA.topIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/incident/${incident.id}`}
                  className="card"
                  style={{
                    padding: "10px 12px",
                    textDecoration: "none",
                    color: "inherit",
                    border: "primary" in incident && incident.primary ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: "primary" in incident && incident.primary ? "var(--accent-bg)" : "var(--bg-surface)",
                  }}
                >
                  <div className="row" style={{ gap: 12 }}>
                    <span className={`sev-dot ${incident.sev}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-primary)", whiteSpace: "nowrap" }}>{incident.id}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{incident.title}</span>
                      </div>
                      <div className="row muted tt" style={{ gap: 10, marginTop: 3 }}>
                        <span>{incident.product}</span>
                        <span>·</span>
                        <span>{incident.signals} signals</span>
                        <span>·</span>
                        <span>opened {incident.age} ago</span>
                        <span>·</span>
                        <span>assigned {incident.assignee}</span>
                      </div>
                    </div>
                    <div className="col" style={{ alignItems: "flex-end", gap: 2 }}>
                      <span className={`mono tt ${confidenceClass(incident.conf)}`} style={{ fontSize: 13 }}>
                        <span className="ai-tag" style={{ marginRight: 4 }} />
                        {incident.conf}%
                      </span>
                      <span className="muted tt">AI confidence</span>
                    </div>
                    <span className="btn sm">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 16 }}>
            <div className="eyebrow">Rising patterns</div>
            <div style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 10px" }}>Correlator spotted in last 24h</div>
            {[
              { title: "Dull-solder language cluster", synopsis: "Voice-of-floor + Trustpilot reviews converging on PM-00008.", trend: [1, 1, 2, 2, 3, 4, 5, 6] },
              { title: "Shift 2 near-miss clustering", synopsis: "EOL near-misses +40% on Stn-04 over 3 days.", trend: [2, 3, 2, 4, 5, 4, 6, 5] },
              { title: "ElektroParts ESR creep", synopsis: "Inbound ESR mean shifting across 4 batches.", trend: [3, 4, 4, 5, 5, 6, 6, 7] },
            ].map((pattern) => (
              <div key={pattern.title} className="card ai-block" style={{ padding: "10px 12px", marginBottom: 8 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 2 }}>
                  <span className="ai-tag">Pattern</span>
                  <span className="muted tt">24h</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{pattern.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink-secondary)", marginBottom: 8, lineHeight: 1.4 }}>{pattern.synopsis}</div>
                <div style={{ width: "100%", marginBottom: 4 }}>
                  <Spark data={pattern.trend} color="var(--cta)" fill height={32} />
                </div>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Link href="/inbox" className="btn ghost sm" style={{ textDecoration: "none" }}>Investigate →</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : variant === "feed" ? (
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow">Unified feed · incidents + patterns</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {PROTOTYPE_DATA.topIncidents.map((incident) => (
              <Link key={incident.id} href={`/incident/${incident.id}`} className="card" style={{ padding: 10, textDecoration: "none", color: "inherit" }}>
                <div className="row" style={{ gap: 12 }}>
                  <span className={`sev-dot ${incident.sev}`} />
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{incident.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{incident.title}</span>
                    </div>
                    <div className="muted tt" style={{ marginTop: 2 }}>{incident.product} · {incident.signals} signals · {incident.age}</div>
                  </div>
                  <span className="btn sm">Open</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: "4px 0", overflow: "hidden" }}>
          <div className="row" style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
            <div className="eyebrow">Triage list · {PROTOTYPE_DATA.topIncidents.length} items + 3 patterns</div>
            <span className="muted tt">Compact · 32px rows</span>
          </div>
          {PROTOTYPE_DATA.topIncidents.map((incident, index) => (
            <Link
              key={incident.id}
              href={`/incident/${incident.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "18px 80px 1fr 60px 70px 70px",
                alignItems: "center",
                gap: 10,
                padding: "6px 14px",
                borderBottom: index < PROTOTYPE_DATA.topIncidents.length - 1 ? "1px solid var(--line)" : "none",
                textDecoration: "none",
                color: "inherit",
                fontSize: 12,
                background: "primary" in incident && incident.primary ? "var(--accent-bg)" : "transparent",
              }}
            >
              <span className={`sev-dot ${incident.sev}`} />
              <span className="mono" style={{ fontWeight: 700, fontSize: 11 }}>{incident.id}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{incident.title}</span>
              <span className="muted tt" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{incident.product}</span>
              <span className="muted tt mono">{incident.signals}sig · {incident.age}</span>
              <span className={`mono tt ${confidenceClass(incident.conf)}`} style={{ textAlign: "right", fontWeight: 600 }}>
                <span className="ai-tag" style={{ marginRight: 3 }} />
                {incident.conf}%
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="panel" style={{ padding: 16, marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div className="eyebrow">Recently resolved · Network effect</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>Lessons applied across {PROTOTYPE_DATA.plants.length} plants</div>
          </div>
          <Link href="/lessons" className="btn ghost sm" style={{ textDecoration: "none" }}>Go to library →</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {PROTOTYPE_DATA.lessons.slice(0, 4).map((lesson) => {
            const recurring = lesson.outcome === "recurring";
            return (
              <div key={lesson.id} className="card" style={{ padding: 12, borderTop: recurring ? "2px solid var(--amber)" : "1px solid var(--line)" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="eyebrow mono">{lesson.id}</span>
                  <span className={`chip ${recurring ? "sev-med" : "sev-low"}`}>
                    <span className="dot" style={{ background: recurring ? "var(--amber)" : "var(--sev-low)" }} />
                    {recurring ? "recurring" : "resolved"}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, margin: "8px 0 4px", lineHeight: 1.35 }}>{lesson.sig}</div>
                <div className="muted tt" style={{ marginBottom: 8, lineHeight: 1.4 }}>{lesson.fix}</div>
                <div style={{ fontSize: 11, color: "var(--cta)", fontWeight: 700 }}>Applied {lesson.applied}× across {lesson.plants} plants</div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export function PrototypeInboxScreen() {
  const [variant, setVariant] = useState<"table" | "cards">("table");
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [hover, setHover] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [drillFilter, setDrillFilter] = useState("");
  const [inboxReady, setInboxReady] = useState(false);

  useEffect(() => {
    const savedVariant = window.localStorage.getItem("inbox.var");
    if (savedVariant === "cards" || savedVariant === "table") {
      setVariant(savedVariant);
    }
    setLeftOpen(window.localStorage.getItem("inbox.left") !== "0");
    setRightOpen(window.localStorage.getItem("inbox.right") !== "0");
    const savedDrillFilter = window.localStorage.getItem("inbox.drillFilter") ?? "";
    if (savedDrillFilter) {
      setDrillFilter(savedDrillFilter);
      window.localStorage.removeItem("inbox.drillFilter");
    }
    setInboxReady(true);
  }, []);

  useEffect(() => {
    if (!inboxReady) return;
    window.localStorage.setItem("inbox.var", variant);
    window.localStorage.setItem("inbox.left", leftOpen ? "1" : "0");
    window.localStorage.setItem("inbox.right", rightOpen ? "1" : "0");
  }, [inboxReady, variant, leftOpen, rightOpen]);

  const rows = useMemo(() => {
    const base = drillFilter
      ? PROTOTYPE_DATA.inbox.filter((row) => {
          const hay = `${row.id} ${row.title} ${row.product}`.toLowerCase();
          return hay.includes(drillFilter.toLowerCase());
        })
      : PROTOTYPE_DATA.inbox;

    return base.filter((row) => {
      if (filter === "all") return true;
      if (filter === "mine") return row.owner === PROTOTYPE_DATA.user.initials;
      if (filter === "unassigned") return row.owner === "—";
      if (filter === "critical") return row.sev === "crit";
      if (filter === "field") return row.sources.includes("mail") || row.sources.includes("wave");
      if (filter === "floor") return row.sources.includes("mic") || row.sources.includes("factory");
      if (filter === "supplier") return row.sources.includes("truck");
      return true;
    });
  }, [drillFilter, filter]);

  const hoverRow = hover ? rows.find((row) => row.id === hover) : rows.find((row) => row.primary);
  const gridCols = `${leftOpen ? "220px" : "40px"} 1fr ${rightOpen ? "320px" : "40px"}`;
  const sourceAbbr: Record<string, string> = {
    mail: "CRM",
    truck: "INB",
    chart: "EOL",
    mic: "Voice",
    wave: "IoT",
    trend: "SPC",
    factory: "Rework",
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <main style={{ display: "grid", gridTemplateColumns: gridCols, height: "calc(100vh - 52px)", transition: "grid-template-columns 200ms ease" }}>
      {leftOpen ? (
        <aside className="side-rail" style={{ borderRight: "1px solid var(--line)", padding: "14px 12px", overflow: "auto", background: "#fff" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="eyebrow">Saved filters</div>
            <button className="rail-toggle" type="button" onClick={() => setLeftOpen(false)} title="Collapse filter rail">‹</button>
          </div>
          {[
            { id: "all", label: "All", n: 14 },
            { id: "mine", label: "Mine", n: 5 },
            { id: "unassigned", label: "Unassigned", n: 2 },
            { id: "critical", label: "Critical", n: 0 },
            { id: "field", label: "From field", n: 12 },
            { id: "floor", label: "From floor", n: 3 },
            { id: "supplier", label: "From supplier", n: 4 },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              style={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: 6,
                marginBottom: 2,
                fontSize: 12,
                background: filter === item.id ? "var(--accent-bg)" : "transparent",
                color: filter === item.id ? "var(--cta)" : "var(--ink-secondary)",
                fontWeight: filter === item.id ? 600 : 500,
                border: "none",
              }}
            >
              <span>{item.label}</span>
              <span className="muted tt">{item.n}</span>
            </button>
          ))}
          <div className="divider" style={{ margin: "14px 0" }} />
          <div className="eyebrow" style={{ marginBottom: 8 }}>Sources</div>
          {["CRM", "MES", "Warranty", "Voice", "Social", "Inbound", "SPC", "EOL"].map((source) => (
            <label key={source} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 8px", fontSize: 12, color: "var(--ink-secondary)" }}>
              <input type="checkbox" defaultChecked />
              {source}
            </label>
          ))}
        </aside>
      ) : (
        <aside className="side-rail collapsed" style={{ borderRight: "1px solid var(--line)", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
          <button className="rail-toggle big" type="button" onClick={() => setLeftOpen(true)} title="Expand filters">›</button>
          <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", marginTop: 14, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>
            Filters {filter !== "all" ? `· ${filter}` : ""}
          </div>
        </aside>
      )}

      <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, alignItems: "center", background: "#fff", flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {PROTOTYPE_DATA.counts.openIncidents} incidents
            <span className="muted" style={{ fontSize: 12, fontWeight: 500, marginLeft: 6 }}>· {rows.length} visible</span>
          </div>
          {filter !== "all" ? (
            <span className="chip" style={{ background: "var(--accent-bg)", color: "var(--cta)", borderColor: "var(--accent-ring)" }}>
              filter: {filter}
              <button type="button" onClick={() => setFilter("all")} style={{ marginLeft: 4, color: "var(--cta)", background: "transparent", border: "none" }}>×</button>
            </span>
          ) : null}
          {drillFilter ? (
            <span className="chip" style={{ background: "var(--accent-bg)", color: "var(--cta)", borderColor: "var(--accent-ring)" }}>
              drill-down: &quot;{drillFilter}&quot;
              <button type="button" onClick={() => setDrillFilter("")} style={{ marginLeft: 4, color: "var(--cta)", background: "transparent", border: "none" }}>×</button>
            </span>
          ) : null}
          {selected.length > 0 ? (
            <div className="row" style={{ gap: 6, marginLeft: 12 }}>
              <span className="chip" style={{ background: "var(--accent-bg)", color: "var(--cta)" }}>{selected.length} selected</span>
              <button className="btn sm" type="button">Assign</button>
              <button className="btn sm" type="button">Dismiss</button>
              {selected.length >= 2 ? <button className="btn primary sm" type="button">⎘ Merge into one incident</button> : null}
            </div>
          ) : (
            <span className="muted tt" style={{ marginLeft: 12 }}>Click a row for preview · Select 2+ to merge</span>
          )}
          <div className="spacer" />
          <div className="var-tabs">
            {([
              { id: "table", label: "Table" },
              { id: "cards", label: "Cards" },
            ] as const).map((item) => (
              <button key={item.id} type="button" className={variant === item.id ? "on" : ""} onClick={() => setVariant(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <button className="btn ghost sm" type="button" onClick={() => { setLeftOpen(false); setRightOpen(false); }}>⤢ Maximize</button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {variant === "table" ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--ink-muted)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", background: "#fff" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", width: 32 }} />
                  <th style={{ padding: "10px 6px", textAlign: "left", width: 24 }} />
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Incident</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Product</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Sources</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Signals</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Last seen</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Owner</th>
                  <th style={{ padding: "10px 8px", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "left" }}>AI conf.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isHover = hover === row.id;
                  const shown = row.sources.slice(0, 2);
                  const extra = row.sources.length - shown.length;
                  return (
                    <tr
                      key={row.id}
                      onMouseEnter={() => setHover(row.id)}
                      style={{
                        borderTop: "1px solid var(--line)",
                        background: row.primary ? "var(--accent-bg)" : isHover ? "var(--bg-subtle)" : "transparent",
                      }}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleSelected(row.id)} />
                      </td>
                      <td style={{ padding: "12px 6px" }}><span className={`sev-dot ${row.sev}`} /></td>
                      <td style={{ padding: "12px 8px" }}>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-primary)", whiteSpace: "nowrap" }}>{row.id}</span>
                          <Link href={`/incident/${row.id}`} style={{ fontWeight: 500, color: "inherit", textDecoration: "none" }}>{row.title}</Link>
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px" }} className="mono muted">{row.product}</td>
                      <td style={{ padding: "12px 8px" }}>
                        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                          {shown.map((source, index) => (
                            <span key={`${row.id}-${source}-${index}`} className="chip" style={{ padding: "1px 6px", fontSize: 10, background: "var(--bg-inset)" }}>
                              {sourceAbbr[source] ?? source}
                            </span>
                          ))}
                          {extra > 0 ? <span className="chip" style={{ padding: "1px 6px", fontSize: 10, color: "var(--cta)", fontWeight: 700 }}>+{extra}</span> : null}
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px" }} className="mono">{row.count}</td>
                      <td style={{ padding: "12px 8px" }} className="muted">{row.last}</td>
                      <td style={{ padding: "12px 8px" }}>{row.owner}</td>
                      <td style={{ padding: "12px 8px" }}><span className={`status-chip ${row.status}`}>{row.status}</span></td>
                      <td style={{ padding: "12px 14px" }} className={`mono ${confidenceClass(row.conf)}`}>
                        <span className="ai-tag" style={{ marginRight: 3 }} />
                        {row.conf}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10 }}>
              {rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/incident/${row.id}`}
                  className="card"
                  style={{
                    padding: 12,
                    cursor: "pointer",
                    border: row.primary ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: row.primary ? "var(--accent-bg)" : "#fff",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`sev-dot ${row.sev}`} />
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{row.id}</span>
                    </div>
                    <span className={`mono tt ${confidenceClass(row.conf)}`}>
                      <span className="ai-tag" style={{ marginRight: 3 }} />
                      {row.conf}%
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{row.title}</div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted tt">{row.product} · {row.count} signals · {row.last}</span>
                    <span className={`status-chip ${row.status}`}>{row.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {rightOpen ? (
        <aside className="side-rail" style={{ borderLeft: "1px solid var(--line)", padding: "14px 16px", overflow: "auto", background: "#fff" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
            <div className="eyebrow">Preview</div>
            <button className="rail-toggle" type="button" onClick={() => setRightOpen(false)} title="Collapse preview">›</button>
          </div>
          {hoverRow ? (
            <>
              <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                <span className={`sev-dot ${hoverRow.sev}`} />
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{hoverRow.id}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, marginBottom: 10 }}>{hoverRow.title}</div>
              <div className="ai-block" style={{ marginBottom: 14 }}>
                <div className="ai-tag" style={{ marginBottom: 4 }}>AI summary</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink-secondary)" }}>
                  Convergent signals from CRM warranty, inbound inspection, and EOL near-miss clustering. Most likely cause: supplier batch ESR out of spec. Confidence {hoverRow.conf}%.
                </div>
              </div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Top 3 signals</div>
              {PROTOTYPE_DATA.incident.signals.slice(0, 3).map((signal) => (
                <div key={signal.id} className="card" style={{ padding: 10, marginBottom: 6, background: "var(--bg-subtle)" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 3, gap: 6 }}>
                    <span className="mono tt muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                      {signal.id} · {signal.src}
                    </span>
                    <span className={`sev-dot ${signal.sev}`} style={{ flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.4 }}>{signal.text}</div>
                </div>
              ))}
              <Link href={`/incident/${hoverRow.id}`} className="btn primary" style={{ width: "100%", marginTop: 10, justifyContent: "center", textDecoration: "none" }}>
                Open canvas →
              </Link>
            </>
          ) : (
            <div className="muted tt" style={{ textAlign: "center", marginTop: 40 }}>Hover a row to preview</div>
          )}
        </aside>
      ) : (
        <aside className="side-rail collapsed" style={{ borderLeft: "1px solid var(--line)", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0" }}>
          <button className="rail-toggle big" type="button" onClick={() => setRightOpen(true)} title="Expand preview">‹</button>
          <div style={{ writingMode: "vertical-rl", marginTop: 14, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-muted)", fontWeight: 600 }}>
            Preview
          </div>
        </aside>
      )}
    </main>
  );
}
