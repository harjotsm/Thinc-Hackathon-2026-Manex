"use client";

import Link from "next/link";
import { useState } from "react";
import { PROTOTYPE_DATA } from "@/lib/prototype-data";
import { VoiceRecorder } from "@/components/voice/voice-recorder";

function systemClass(target: string) {
  return `sys-pill ${target.toLowerCase()}`;
}

function dueClass(value: string) {
  if (!value || value === "—") return "normal";
  const match = value.match(/(\d+)d/);
  if (!match) return "normal";
  const days = Number(match[1]);
  if (days <= 1) return "over";
  if (days <= 3) return "warn";
  return "normal";
}

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

export function PrototypeInitiativesScreen() {
  const [selected, setSelected] = useState(PROTOTYPE_DATA.initiatives[0]?.id ?? null);
  const selectedInit = PROTOTYPE_DATA.initiatives.find((initiative) => initiative.id === selected) ?? null;
  const columns = [
    { id: "todo", label: "To do" },
    { id: "progress", label: "In progress" },
    { id: "blocked", label: "Blocked" },
    { id: "verify", label: "Verifying" },
    { id: "closed", label: "Closed" },
  ] as const;

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 320px", height: "calc(100vh - 52px)" }}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "18px 24px 10px" }}>
          <div className="eyebrow">Initiatives</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: "var(--ink-primary)", marginTop: 6 }}>
            37 active across 5 swimlanes
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, minHeight: "100%" }}>
            {columns.map((column) => {
              const items = PROTOTYPE_DATA.initiatives.filter((initiative) => initiative.col === column.id);
              return (
                <div key={column.id} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
                  <div className="row" style={{ justifyContent: "space-between", padding: "6px 10px" }}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="eyebrow" style={{ color: column.id === "todo" ? "var(--cta)" : "var(--ink-muted)" }}>
                        {column.label}
                      </span>
                      <span className="chip">{items.length}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: "var(--bg-subtle)", borderRadius: 8, padding: 8, border: "1px solid var(--line)", overflow: "auto" }}>
                    {items.map((initiative) => (
                      <div
                        key={initiative.id}
                        className="card"
                        onClick={() => setSelected(initiative.id)}
                        style={{
                          padding: "8px 10px",
                          marginBottom: 6,
                          cursor: "pointer",
                          border: selected === initiative.id ? "1.5px solid var(--cta)" : initiative.col === "todo" ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                          background: selected === initiative.id || initiative.col === "todo" ? "var(--accent-bg)" : "var(--bg-surface)",
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4, gap: 6 }}>
                          <span className="mono tt muted">{initiative.id}</span>
                          <Link href={`/incident/${PROTOTYPE_DATA.incident.id}`} className="mono tt" style={{ color: "var(--cta)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                            ← {PROTOTYPE_DATA.incident.id}
                          </Link>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, marginBottom: 8, overflowWrap: "anywhere" }}>{initiative.title}</div>
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                          <span className={systemClass(initiative.target)}>{initiative.target}</span>
                          <span className="row" style={{ gap: 6 }}>
                            <span className="avatar" style={{ width: 16, height: 16, fontSize: 8 }}>{initiative.owner}</span>
                            <span className={`due ${dueClass(initiative.due)}`} style={{ fontSize: 11 }}>{initiative.due}</span>
                          </span>
                        </div>
                        <div className="ai-block" style={{ fontSize: 10.5, paddingTop: 3, marginTop: 3, borderTop: "1px dashed var(--line)" }}>
                          <span className="ai-tag" style={{ marginRight: 3 }} />
                          <span style={{ color: "var(--ink-secondary)" }}>{initiative.impact}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside style={{ borderLeft: "1px solid var(--line)", padding: "14px 16px", overflow: "auto", background: "#fff" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Detail</div>
        {selectedInit ? (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className="mono tt muted">{selectedInit.id}</span>
              <Link href={`/incident/${PROTOTYPE_DATA.incident.id}`} className="mono tt" style={{ color: "var(--cta)", fontWeight: 600, textDecoration: "none" }}>
                ← {PROTOTYPE_DATA.incident.id}
              </Link>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, marginBottom: 10 }}>{selectedInit.title}</div>
            <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              <span className={systemClass(selectedInit.target)}>{selectedInit.target}</span>
              <span className="chip">{selectedInit.col}</span>
              <span className={`due ${dueClass(selectedInit.due)}`} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--bg-inset)" }}>
                {selectedInit.due}
              </span>
            </div>
            <div className="ai-block" style={{ marginBottom: 14 }}>
              <div className="ai-tag" style={{ marginBottom: 4 }}>Projected impact</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--ink-secondary)" }}>{selectedInit.impact}</div>
            </div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Owner</div>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>{selectedInit.owner}</div>
              <div style={{ fontSize: 12 }}>Quality engineer</div>
            </div>
            <Link href={`/incident/${PROTOTYPE_DATA.incident.id}`} className="btn primary" style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}>
              Open incident canvas →
            </Link>
          </>
        ) : null}
      </aside>
    </main>
  );
}

export function PrototypeLessonsScreen() {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const tagsByLesson: Record<string, string[]> = {
    "LES-018": ["solder", "supplier", "SB-00007"],
    "LES-022": ["thermal", "R33", "PM-00012"],
    "LES-014": ["torque", "calibration", "Stn-04"],
    "LES-031": ["rework", "operator", "shift-2"],
    "LES-009": ["label", "printer", "L3"],
    "LES-027": ["EOL", "near-miss", "SPC"],
  };
  const allTags = Array.from(new Set(Object.values(tagsByLesson).flat()));
  const totalApplied = PROTOTYPE_DATA.lessons.reduce((sum, lesson) => sum + lesson.applied, 0);

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
      <div style={{ padding: "16px 24px 10px", background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ gap: 24, marginBottom: 12 }}>
          <div className="ai-block">
            <div className="ai-tag" style={{ marginBottom: 2 }}>Network effect</div>
            <div style={{ fontSize: 14 }}>
              <b style={{ fontSize: 18, color: "var(--cta)" }}>324</b> lessons · applied <b>{totalApplied.toLocaleString()}×</b> · across <b>{PROTOTYPE_DATA.plants.length} plants</b>
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>Filters:</span>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag((current) => (current === tag ? null : tag))}
              className="chip"
              style={{
                cursor: "pointer",
                background: activeTag === tag ? "var(--cta)" : "var(--bg-inset)",
                color: activeTag === tag ? "#fff" : "var(--ink-secondary)",
                borderColor: activeTag === tag ? "var(--cta)" : "var(--line)",
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {PROTOTYPE_DATA.lessons
            .filter((lesson) => !activeTag || tagsByLesson[lesson.id]?.includes(activeTag))
            .map((lesson) => {
              const recurring = lesson.outcome === "recurring";
              const tags = tagsByLesson[lesson.id] ?? [];
              return (
                <div key={lesson.id} className="card" style={{ padding: 14, borderTop: recurring ? "2px solid var(--amber)" : "1px solid var(--line)" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="eyebrow mono" style={{ color: "var(--cta)" }}>⚡ {lesson.id}</span>
                    <span className={`chip ${recurring ? "sev-med" : "sev-low"}`}>{lesson.outcome}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginBottom: 6 }}>{lesson.sig}</div>
                  <div className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>{lesson.fix}</div>
                  <div className="row" style={{ gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
                    {tags.map((tag) => (
                      <span key={tag} className="chip" style={{ fontSize: 10, padding: "1px 7px" }}>{tag}</span>
                    ))}
                  </div>
                  <div className="row" style={{ justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--cta)", fontWeight: 700 }}>Applied {lesson.applied}× · {lesson.plants} plants</span>
                    <span className="muted tt">→ {PROTOTYPE_DATA.incident.id}</span>
                  </div>
                  <Spark data={lesson.trend} color={recurring ? "var(--amber)" : "var(--sev-low)"} fill height={40} />
                  <div className="muted tt" style={{ textAlign: "center", marginTop: -2 }}>recurrence after applied (8w)</div>
                </div>
              );
            })}
        </div>
      </div>
    </main>
  );
}

export function PrototypeConnectorsScreen() {
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
      <div style={{ padding: "18px 24px 10px" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="eyebrow">Signal sources</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--ink-primary)", marginTop: 6 }}>Connectors</div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="chip" style={{ color: "var(--cta)", borderColor: "var(--accent-ring)", background: "var(--accent-bg)" }}>14 connected</span>
            <span className="chip sev-med">4 partial</span>
            <span className="chip">1 disconnected</span>
            <button className="btn primary" type="button">Add source</button>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {PROTOTYPE_DATA.connectors.map((group) => (
          <section key={group.group} style={{ marginBottom: 22, borderRadius: 12, border: "1px solid var(--line)", background: "rgba(99,159,196,0.05)", overflow: "hidden" }}>
            <header className="row" style={{ padding: "12px 16px", gap: 10, borderBottom: "1px solid var(--line)", background: "#fff" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-inset)", color: "var(--accent-dim)", border: "1px solid rgba(99,159,196,0.25)" }}>
                {group.group[0]}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-primary)" }}>{group.group}</div>
              <span className="chip" style={{ marginLeft: 4 }}>{group.items.length} sources</span>
            </header>
            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                {group.items.map((connector) => (
                  <div key={connector.name} className="card" style={{ padding: 12, background: "var(--bg-surface)" }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--bg-inset)", color: "var(--ink-secondary)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {connector.name[0]}
                      </div>
                      <span className="row" style={{ gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: connector.status === "connected" ? "var(--sev-low)" : connector.status === "partial" ? "var(--amber)" : "var(--ink-muted)", animation: connector.status === "connected" ? "pulse 2s infinite" : "none" }} />
                        <span className="tt" style={{ color: connector.status === "connected" ? "var(--sev-low)" : connector.status === "partial" ? "#9a6b14" : "var(--ink-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 10 }}>
                          {connector.status}
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, margin: "9px 0 2px", lineHeight: 1.3 }}>{connector.name}</div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>{connector.sigs} signals · {connector.last}</span>
                      {connector.status === "partial" ? <span style={{ fontSize: 10, color: "var(--cta)", fontWeight: 600 }}>Details →</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export function PrototypeLeadershipScreen() {
  const [variant, setVariant] = useState<"exec" | "dense">("exec");
  const maxPareto = Math.max(...PROTOTYPE_DATA.pareto.map((item) => item.cost));
  const plantZones = [
    { name: "Montage Linie 1", n: 17, hot: true },
    { name: "Montage Linie 2", n: 5 },
    { name: "Pruefung Linie 1", n: 4 },
    { name: "Pruefung Linie 2", n: 12, bias: true },
    { name: "Packaging", n: 2 },
    { name: "EOL Test", n: 8 },
  ] as const;
  const maxZone = Math.max(...plantZones.map((zone) => zone.n));
  const heatFill = (count: number, hot: boolean) => {
    const t = count / maxZone;
    if (hot) return `rgba(244,138,92,${0.12 + t * 0.35})`;
    return `rgba(99,159,196,${0.08 + t * 0.35})`;
  };

  const plantMap = [
    { code: "UK", plant: "Birmingham", count: 2, x: 22, y: 22 },
    { code: "NL", plant: "Eindhoven", count: 5, x: 32, y: 30 },
    { code: "DE-N", plant: "Werk Hamburg", count: 6, x: 48, y: 28 },
    { code: "DE-E", plant: "Werk Leipzig", count: 4, x: 60, y: 36 },
    { code: "PL", plant: "Wrocław", count: 4, x: 72, y: 32 },
    { code: "FR", plant: "Lyon", count: 3, x: 34, y: 56 },
    { code: "DE-S", plant: "Werk München", count: 8, x: 54, y: 48, hot: true },
    { code: "CZ", plant: "Brno", count: 7, x: 70, y: 50 },
    { code: "AT", plant: "Graz", count: 2, x: 60, y: 62 },
    { code: "ES", plant: "Valencia", count: 9, x: 18, y: 78 },
    { code: "IT", plant: "Torino", count: 5, x: 40, y: 70 },
    { code: "HU", plant: "Győr", count: 4, x: 68, y: 62 },
  ] as const;
  const maxPlant = Math.max(...plantMap.map((plant) => plant.count));
  const initCounts = [
    { name: "To do", n: 8, accent: true },
    { name: "In progress", n: 14, hero: true },
    { name: "Blocked", n: 3, bad: true },
    { name: "Verifying", n: 7 },
    { name: "Closed", n: 5 },
  ] as const;
  const maxInit = Math.max(...initCounts.map((lane) => lane.n));

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
      <div className="sh" style={{ padding: "16px 24px 10px", borderBottom: "1px solid var(--line)", background: "#fff" }}>
        <div>
          <div className="eyebrow">Leadership lens · {PROTOTYPE_DATA.user.plant}</div>
          <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 600 }}>Quality at a glance</h1>
        </div>
        <div className="spacer" />
        <div className="var-tabs">
          {(["exec", "dense"] as const).map((item) => (
            <button key={item} type="button" className={variant === item ? "on" : ""} onClick={() => setVariant(item)}>
              {item === "exec" ? "Exec" : "Dense"}
            </button>
          ))}
        </div>
      </div>

      <div className={variant === "dense" ? "lead-dense" : ""} style={{ flex: 1, overflow: "auto", padding: variant === "dense" ? 12 : 18 }}>
        <div className="panel" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
          {[
            { label: "Open incidents", value: 14, delta: "↑ 3 vs 7d", cls: "bad", data: [1, 2, 3, 4, 5, 6, 5, 7], accent: true },
            { label: "€ at risk", value: "€312k", delta: "↓ 8% vs 7d", cls: "good", data: [7, 6, 5, 5, 4, 4, 3, 3] },
            { label: "Avg time-to-close", value: "3.4d", delta: "↓ 0.8d vs 30d", cls: "good", data: [5, 5, 4, 4, 3, 3, 3, 3] },
            { label: "Claims avoided · Q2", value: 84, delta: "↑ 28 vs Q1", cls: "good", data: [3, 4, 5, 5, 6, 7, 8, 9] },
          ].map((metric, index) => (
            <div key={metric.label} className="metric" style={{ borderRight: index < 3 ? "1px solid var(--line)" : "none" }}>
              <span className="label">{metric.label}</span>
              <span className={`value ${metric.accent ? "accent" : ""}`}>{metric.value}</span>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className={`delta ${metric.cls}`}>{metric.delta}</span>
                <Spark data={metric.data} color={metric.accent ? "var(--cta)" : "var(--ink-muted)"} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Incident Pareto · by cost impact</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Top drivers, last 30 days</div>
            {PROTOTYPE_DATA.pareto.map((item) => {
              const isPrimary = "primary" in item && Boolean(item.primary);
              return (
                <div key={item.code} className="row" style={{ gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 200, fontSize: 12, fontWeight: isPrimary ? 600 : 500 }}>{item.code}</span>
                  <div style={{ flex: 1, height: 14, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(item.cost / maxPareto) * 100}%`, height: "100%", background: isPrimary ? "var(--cta)" : "#94A3B8" }} />
                  </div>
                  <span className="mono tt" style={{ width: 50, textAlign: "right", color: isPrimary ? "var(--cta)" : "var(--ink-muted)", fontWeight: isPrimary ? 700 : 500 }}>
                    €{item.cost}k
                  </span>
                </div>
              );
            })}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Plant heatmap · Werk München</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Linien · incident density</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {plantZones.map((zone) => {
                const isHot = "hot" in zone && Boolean(zone.hot);
                const isBias = "bias" in zone && Boolean(zone.bias);
                return (
                  <div
                    key={zone.name}
                    style={{
                      padding: 10,
                      background: isBias ? "rgba(224,165,58,0.12)" : heatFill(zone.n, isHot),
                      border: `1px solid ${isBias ? "rgba(224,165,58,0.4)" : isHot ? "rgba(244,138,92,0.35)" : "var(--line)"}`,
                      borderRadius: 6,
                      minHeight: 80,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-primary)" }}>{zone.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: isHot ? "var(--sev-high)" : isBias ? "#9a6b14" : "var(--ink-primary)", marginTop: 4, lineHeight: 1 }}>{zone.n}</div>
                    <div className="muted tt" style={{ marginTop: 2 }}>incidents</div>
                    {isBias ? (
                      <div className="mono" style={{ fontSize: 9, color: "#9a6b14", marginTop: 6, fontStyle: "italic", lineHeight: 1.3 }}>
                        * detection bias
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Cross-plant incidents</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Network-wide view</div>
            <div style={{ position: "relative", height: 220, background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--line)", overflow: "hidden" }}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                <defs>
                  <pattern id="plant-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(99,159,196,0.10)" strokeWidth="0.3" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#plant-grid)" />
              </svg>
              {plantMap.map((plant) => {
                const t = plant.count / maxPlant;
                const r = 6 + t * 8;
                return (
                  <div key={plant.code}>
                    <div
                      title={`${plant.plant} · ${plant.count} incidents`}
                      style={{
                        position: "absolute",
                        left: `calc(${plant.x}% - ${r}px)`,
                        top: `calc(${plant.y}% - ${r}px)`,
                        width: r * 2,
                        height: r * 2,
                        borderRadius: "50%",
                        background: "hot" in plant && plant.hot ? "var(--accent)" : "rgba(99,159,196,0.6)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${plant.x}%`,
                        top: `calc(${plant.y}% + ${r + 3}px)`,
                        transform: "translateX(-50%)",
                        fontSize: 10,
                        color: "hot" in plant && plant.hot ? "var(--accent)" : "var(--ink-secondary)",
                        fontWeight: "hot" in plant && plant.hot ? 600 : 500,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      {plant.plant} · {plant.count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="row" style={{ justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "var(--ink-muted)" }}>
              <span>12 plants · 9 countries</span>
              <span className="mono" style={{ color: "var(--sev-high)", fontWeight: 600 }}>München outlier: 14 incidents</span>
            </div>
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Open initiatives</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>37 across 5 swimlanes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {initCounts.map((lane) => {
                const isBad = "bad" in lane && Boolean(lane.bad);
                const isHero = "hero" in lane && Boolean(lane.hero);
                const isAccent = "accent" in lane && Boolean(lane.accent);
                return (
                  <div key={lane.name} className="row" style={{ gap: 10 }}>
                    <span style={{ width: 82, fontSize: 12, color: "var(--ink-secondary)" }}>{lane.name}</span>
                    <div style={{ flex: 1, height: 20, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${(lane.n / maxInit) * 100}%`, height: "100%", background: isBad ? "var(--sev-crit)" : isHero ? "var(--cta)" : isAccent ? "var(--accent)" : "#94A3B8" }} />
                    </div>
                    <span className="mono" style={{ width: 28, textAlign: "right", fontWeight: 700, fontSize: isHero ? 16 : 13, color: isBad ? "var(--sev-crit)" : isHero ? "var(--cta)" : "var(--ink-primary)" }}>{lane.n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function PrototypeFloorScreen() {
  const [variant, setVariant] = useState<"classic" | "minimal" | "chat">("classic");
  const [lang, setLang] = useState<"de" | "en">("de");
  const t = lang === "de"
    ? {
        greeting: "Hallo Markus",
        line: "Montage Linie 1",
        prompt: "Was ist dir aufgefallen?",
        sub: "Tippe was passt, oder halte das Mikro.",
        placeholder: "Beschreibe kurz, was los ist…",
        mic: "Mikro halten für Sprachnotiz",
        sample: "…der dritte Kratzer in dieser Schicht…",
        send: "Bericht senden",
        thanks: "Danke, Markus.",
        success: "Wir prüfen das. 3 ähnliche Meldungen diese Schicht.",
        see: "Sehen, was wir prüfen →",
        reset: "Neue Meldung",
        minimalSub: "Sag's einfach. Wir kümmern uns.",
        chatPrompt: "Was hast du auf der Linie bemerkt?",
        chatPlaceholder: "Tippen oder Mikro halten…",
      }
    : {
        greeting: "Hi Markus",
        line: "Assembly Line 1",
        prompt: "What did you notice?",
        sub: "Tap what fits, or hold the mic.",
        placeholder: "Briefly describe what's going on…",
        mic: "Hold to add voice note",
        sample: "…the third scratch this shift…",
        send: "Send report",
        thanks: "Thanks, Markus.",
        success: "We're looking into it. 3 similar reports this shift.",
        see: "See what we're checking →",
        reset: "New report",
        minimalSub: "Just tell us. We'll handle the rest.",
        chatPrompt: "What did you notice on the line?",
        chatPlaceholder: "Type or hold mic…",
      };

  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const issues = [
    { id: "scratch", label: "Kratzer / Beule", color: "var(--sev-high)" },
    { id: "noise", label: "Komisches Geräusch", color: "var(--accent)" },
    { id: "batch", label: "Charge wirkt anders", color: "var(--cta)" },
    { id: "label", label: "Falsches Etikett", color: "var(--sev-med)" },
    { id: "heat", label: "Hitze-Warnung", color: "var(--sev-crit)" },
    { id: "other", label: "Etwas anderes", color: "var(--ink-muted)" },
  ];

  const issueLabel = (id: string) => {
    if (lang === "de") {
      if (id === "scratch") return "Kratzer / Beule";
      if (id === "noise") return "Komisches Geräusch";
      if (id === "batch") return "Charge wirkt anders";
      if (id === "label") return "Falsches Etikett";
      if (id === "heat") return "Hitze-Warnung";
      return "Etwas anderes";
    }
    if (id === "scratch") return "Scratch / dent";
    if (id === "noise") return "Strange noise";
    if (id === "batch") return "Batch looks off";
    if (id === "label") return "Wrong label";
    if (id === "heat") return "Heat warning";
    return "Something else";
  };

  const hasInput = Boolean(selectedIssue || note.trim() || transcript.trim());
  const recorderLanguage = lang === "de" ? "de" : "en";
  const handleVoiceSuccess = (result: { signalId: string; transcript: string }) => {
    if (result.transcript?.trim()) {
      setTranscript(result.transcript);
      setNote((current) => (current.trim() ? current : result.transcript));
    }
    setVoiceError(null);
  };
  const handleVoiceInterimTranscript = (text: string) => {
    setTranscript(text);
  };
  const handleVoiceError = (msg: string) => {
    setVoiceError(msg);
  };

  return (
    <main style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#eef3f7", position: "relative" }}>
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 6, zIndex: 10, alignItems: "center" }}>
        <div style={{ display: "inline-flex", background: "#fff", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden", boxShadow: "0 1px 2px rgba(22,0,66,0.04)" }}>
          {(["de", "en"] as const).map((locale) => (
            <button
              key={locale}
              onClick={() => setLang(locale)}
              style={{
                padding: "5px 9px",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                background: lang === locale ? "var(--ink-primary)" : "transparent",
                color: lang === locale ? "#fff" : "var(--ink-muted)",
                border: "none",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {locale}
            </button>
          ))}
        </div>
        <div className="var-tabs">
          {([
            { id: "classic", label: "Tiles" },
            { id: "minimal", label: "Minimal" },
            { id: "chat", label: "Chat" },
          ] as const).map((item) => (
            <button key={item.id} type="button" className={variant === item.id ? "on" : ""} onClick={() => setVariant(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <Link href="/inbox" className="btn ghost sm" style={{ textDecoration: "none" }}>
          ← exit floor lens
        </Link>
      </div>

      <div style={{ width: 390, height: 844, background: "#ffffff", borderRadius: 40, border: "10px solid #1a1a1a", overflow: "hidden", position: "relative", boxShadow: "0 40px 80px rgba(16,50,207,0.25)" }}>
        <div style={{ height: 44, padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>
          <span className="mono">{PROTOTYPE_DATA.now}</span>
          <div style={{ width: 100, height: 28, background: "#1a1a1a", borderRadius: 20 }} />
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.04em" }}>●●● 82%</span>
        </div>

        {!submitted ? (
          <div style={{ padding: "8px 20px 20px", overflow: "auto", height: "calc(100% - 44px)" }}>
            <div className="row" style={{ gap: 10, marginBottom: 18 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>M</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.greeting}</div>
                <div className="muted tt">{t.line} · {PROTOTYPE_DATA.shift}</div>
              </div>
            </div>

            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4, color: "var(--ink-primary)" }}>{variant === "chat" ? t.chatPrompt : t.prompt}</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{variant === "minimal" ? t.minimalSub : t.sub}</div>

            {variant === "minimal" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <VoiceRecorder
                  sourceSystem="voice_floor"
                  actorUserId="user_042"
                  language={recorderLanguage}
                  defaultNote={note.trim() || undefined}
                  onSuccess={handleVoiceSuccess}
                  onInterimTranscript={handleVoiceInterimTranscript}
                  onError={handleVoiceError}
                  render={({ state, startRecording, stopAndUpload }) => {
                    const isRecording = state === "recording";
                    const isBusy = state === "uploading";
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                        <button
                          type="button"
                          onMouseDown={() => {
                            if (isRecording || isBusy) return;
                            void startRecording();
                          }}
                          onMouseUp={() => {
                            if (!isRecording) return;
                            void stopAndUpload();
                          }}
                          onMouseLeave={() => {
                            if (!isRecording) return;
                            void stopAndUpload();
                          }}
                          onTouchStart={() => {
                            if (isRecording || isBusy) return;
                            void startRecording();
                          }}
                          onTouchEnd={() => {
                            if (!isRecording) return;
                            void stopAndUpload();
                          }}
                          disabled={isBusy}
                          style={{
                            width: 180,
                            height: 180,
                            alignSelf: "center",
                            borderRadius: "50%",
                            border: "none",
                            background: isRecording ? "var(--cta)" : "var(--accent)",
                            color: "#fff",
                            fontSize: 22,
                            fontWeight: 700,
                            boxShadow: isRecording ? "0 0 0 12px rgba(16,50,207,0.14)" : "0 12px 26px rgba(99,159,196,0.30)",
                            cursor: isBusy ? "wait" : "pointer",
                          }}
                        >
                          ●
                        </button>
                        <div className="card" style={{ padding: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{isRecording ? "Listening…" : t.mic}</div>
                          <div className="muted tt" style={{ marginTop: 4 }}>{transcript || t.chatPlaceholder}</div>
                          {voiceError ? (
                            <div style={{ marginTop: 6, fontSize: 11, color: "var(--sev-crit)" }}>{voiceError}</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            ) : null}

            {variant === "chat" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                <div className="card" style={{ padding: 10, background: "var(--bg-subtle)" }}>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>{t.chatPrompt}</div>
                </div>
                <div className="card" style={{ padding: 10, borderColor: "var(--accent-ring)", background: "var(--accent-bg)" }}>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>{transcript || t.chatPlaceholder}</div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <VoiceRecorder
                    sourceSystem="voice_floor"
                    actorUserId="user_042"
                    language={recorderLanguage}
                    defaultNote={note.trim() || undefined}
                    onSuccess={handleVoiceSuccess}
                    onInterimTranscript={handleVoiceInterimTranscript}
                    onError={handleVoiceError}
                    render={({ state, startRecording, stopAndUpload }) => {
                      const isRecording = state === "recording";
                      const isBusy = state === "uploading";
                      return (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%" }}>
                          <button
                            type="button"
                            onMouseDown={() => {
                              if (isRecording || isBusy) return;
                              void startRecording();
                            }}
                            onMouseUp={() => {
                              if (!isRecording) return;
                              void stopAndUpload();
                            }}
                            onMouseLeave={() => {
                              if (!isRecording) return;
                              void stopAndUpload();
                            }}
                            onTouchStart={() => {
                              if (isRecording || isBusy) return;
                              void startRecording();
                            }}
                            onTouchEnd={() => {
                              if (!isRecording) return;
                              void stopAndUpload();
                            }}
                            disabled={isBusy}
                            style={{
                              width: 54,
                              height: 54,
                              borderRadius: "50%",
                              border: "none",
                              background: isRecording ? "var(--cta)" : "linear-gradient(180deg, var(--cta), #1f42df)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 18,
                              fontWeight: 700,
                              cursor: isBusy ? "wait" : "pointer",
                            }}
                          >
                            ●
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>{isRecording ? "Listening…" : t.mic}</div>
                            <div className="muted tt" style={{ marginTop: 4 }}>{transcript || t.sample}</div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {voiceError ? (
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--sev-crit)" }}>{voiceError}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {variant === "classic" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {issues.map((issue) => {
                const active = selectedIssue === issue.id;
                return (
                  <button
                    key={issue.id}
                    onClick={() => setSelectedIssue((current) => (current === issue.id ? null : issue.id))}
                    style={{
                      height: 60,
                      background: active ? "var(--accent-bg)" : "#ffffff",
                      border: active ? "2px solid var(--accent)" : "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "0 10px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                      cursor: "pointer",
                      boxShadow: active ? "0 3px 12px rgba(99,159,196,0.18)" : "0 1px 2px rgba(22,0,66,0.04)",
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: active ? issue.color : "var(--bg-subtle)", color: active ? "#fff" : issue.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                      •
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-primary)", lineHeight: 1.2 }}>{issueLabel(issue.id)}</div>
                  </button>
                );
              })}
              </div>
            ) : null}

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t.placeholder}
              style={{
                width: "100%",
                minHeight: 92,
                padding: 12,
                borderRadius: 10,
                border: "1.5px solid var(--accent)",
                fontFamily: "inherit",
                fontSize: 13,
                lineHeight: 1.45,
                color: "var(--ink-primary)",
                resize: "vertical",
                outline: "none",
                background: "#fff",
                boxShadow: "0 0 0 3px rgba(99,159,196,0.12)",
                marginBottom: 16,
              }}
            />

            {variant === "classic" ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, padding: 12, background: "var(--bg-subtle)", borderRadius: 14, border: "1px solid var(--line)" }}>
                <div style={{ flex: 1 }}>
                  <VoiceRecorder
                    sourceSystem="voice_floor"
                    actorUserId="user_042"
                    language={recorderLanguage}
                    defaultNote={note.trim() || undefined}
                    onSuccess={handleVoiceSuccess}
                    onInterimTranscript={handleVoiceInterimTranscript}
                    onError={handleVoiceError}
                    render={({ state, startRecording, stopAndUpload }) => {
                      const isRecording = state === "recording";
                      const isBusy = state === "uploading";
                      return (
                        <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%" }}>
                          <button
                            type="button"
                            onMouseDown={() => {
                              if (isRecording || isBusy) return;
                              void startRecording();
                            }}
                            onMouseUp={() => {
                              if (!isRecording) return;
                              void stopAndUpload();
                            }}
                            onMouseLeave={() => {
                              if (!isRecording) return;
                              void stopAndUpload();
                            }}
                            onTouchStart={() => {
                              if (isRecording || isBusy) return;
                              void startRecording();
                            }}
                            onTouchEnd={() => {
                              if (!isRecording) return;
                              void stopAndUpload();
                            }}
                            disabled={isBusy}
                            style={{
                              width: 54,
                              height: 54,
                              borderRadius: "50%",
                              border: "none",
                              background: isRecording ? "var(--cta)" : "linear-gradient(180deg, var(--cta), #1f42df)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 18,
                              fontWeight: 700,
                              cursor: isBusy ? "wait" : "pointer",
                            }}
                          >
                            ●
                          </button>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-primary)" }}>{isRecording ? "Listening…" : t.mic}</div>
                            <div className="muted tt" style={{ marginTop: 4 }}>{transcript || t.sample}</div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {voiceError ? (
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--sev-crit)" }}>{voiceError}</div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <button
              className="btn primary"
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!hasInput}
              style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: 14, opacity: hasInput ? 1 : 0.5, cursor: hasInput ? "pointer" : "not-allowed" }}
            >
              {t.send}
            </button>

            <div style={{ marginTop: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Meine Meldungen heute</div>
              <div className="col" style={{ gap: 8 }}>
                {PROTOTYPE_DATA.floorReports.map((report) => (
                  <div key={`${report.status}-${report.text}`} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-primary)" }}>{report.text}</span>
                      <span className="chip">{report.status}</span>
                    </div>
                    <div className="muted tt" style={{ marginTop: 6 }}>{report.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", justifyContent: "center", height: "calc(100% - 44px)" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-bg)", color: "var(--cta)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, marginBottom: 18 }}>✓</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink-primary)", marginBottom: 8 }}>{t.thanks}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-secondary)", marginBottom: 18 }}>
              {t.success}
            </div>
            <Link href={`/incident/${PROTOTYPE_DATA.incident.id}`} className="btn primary" style={{ justifyContent: "center", textDecoration: "none", padding: "12px 18px", fontSize: 14 }}>
              {t.see}
            </Link>
            <button className="btn" type="button" onClick={() => setSubmitted(false)} style={{ marginTop: 10, justifyContent: "center", padding: "12px 18px", fontSize: 14 }}>
              {t.reset}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
