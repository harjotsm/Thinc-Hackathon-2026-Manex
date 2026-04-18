// Initiatives board, Lessons library, Connectors, Leadership, Floor

// ============ INITIATIVES ============
function InitiativesScreen() {
  const { showAnno, setRoute } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("init.var") || "board");
  const [leftOpen, setLeftOpen] = React.useState(() => localStorage.getItem("init.left") !== "0");
  const [rightOpen, setRightOpen] = React.useState(() => localStorage.getItem("init.right") !== "0");
  const [selected, setSelected] = React.useState(null);
  const [agentFilter, setAgentFilter] = React.useState(null);
  const [targetFilter, setTargetFilter] = React.useState(null);
  React.useEffect(() => { localStorage.setItem("init.var", variant); }, [variant]);
  React.useEffect(() => { localStorage.setItem("init.left", leftOpen ? "1" : "0"); }, [leftOpen]);
  React.useEffect(() => { localStorage.setItem("init.right", rightOpen ? "1" : "0"); }, [rightOpen]);

  const cols = [
    { id:"todo", label:"To do", count: DATA.initiatives.filter(i => i.col === "todo").length, accent:true },
    { id:"progress", label:"In progress", count: DATA.initiatives.filter(i => i.col === "progress").length },
    { id:"blocked", label:"Blocked", count: DATA.initiatives.filter(i => i.col === "blocked").length },
    { id:"verify", label:"Verifying", count: DATA.initiatives.filter(i => i.col === "verify").length },
    { id:"closed", label:"Closed", count: DATA.initiatives.filter(i => i.col === "closed").length },
  ];

  const impactChip = (s) => {
    if (!s || s === "—" || s === "done") return null;
    const m = s.match(/(\d+)/);
    if (m) return { label: s, n: m[1] };
    return { label: s };
  };

  const dueClass = (d) => {
    if (!d || d === "—") return "normal";
    const m = d.match(/(\d+)d/);
    if (!m) return "normal";
    const n = parseInt(m[1]);
    if (n <= 1) return "over";
    if (n <= 3) return "warn";
    return "normal";
  };

  const incidentFor = (id) => {
    const map = {
      "INI-091":"INC-00001", "INI-092":"INC-00001", "INI-088":"INC-00009",
      "INI-089":"INC-00001", "INI-093":"INC-00001", "INI-081":"INC-00001",
      "INI-074":"INC-00009", "INI-077":"INC-00001", "INI-061":"INC-00012",
      "INI-058":"INC-00011",
    };
    return map[id] || "INC-00001";
  };

  // Filter
  const visibleInits = DATA.initiatives.filter(i =>
    (!agentFilter || i.agent === agentFilter) &&
    (!targetFilter || i.target === targetFilter)
  );

  // Aggregate counts for filter rail
  const byAgent = {};
  const byTarget = {};
  DATA.initiatives.forEach(i => {
    byAgent[i.agent] = (byAgent[i.agent] || 0) + 1;
    byTarget[i.target] = (byTarget[i.target] || 0) + 1;
  });

  const selectedInit = selected ? DATA.initiatives.find(i => i.id === selected) : null;

  const gridCols = [
    leftOpen ? "200px" : "40px",
    "1fr",
    rightOpen ? "320px" : "40px"
  ].join(" ");

  return (
    <div style={{display:"grid", gridTemplateColumns:gridCols, height:"calc(100vh - 52px)", transition:"grid-template-columns 200ms ease"}}>

      {/* Left filter rail */}
      {leftOpen ? (
        <aside className="side-rail" style={{borderRight:"1px solid var(--line)", padding:"14px 12px", overflow:"auto", background:"#fff"}}>
          <div className="row" style={{justifyContent:"space-between", marginBottom:8}}>
            <div className="eyebrow">By agent</div>
            <button className="rail-toggle" onClick={() => setLeftOpen(false)} title="Collapse filters">‹</button>
          </div>
          {Object.entries(byAgent).map(([a,n]) => {
            const Ico = I[a] || I.factory;
            return (
              <button key={a} onClick={() => setAgentFilter(agentFilter === a ? null : a)}
                style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center",
                  padding:"6px 8px", borderRadius:6, marginBottom:2, fontSize:12,
                  background: agentFilter === a ? "var(--accent-bg)" : "transparent",
                  color: agentFilter === a ? "var(--cta)" : "var(--ink-secondary)",
                  fontWeight: agentFilter === a ? 600 : 500}}>
                <span className="row" style={{gap:8}}><Ico size={11}/>{a}</span>
                <span className="muted tt">{n}</span>
              </button>
            );
          })}
          <div className="divider" style={{margin:"14px 0"}}/>
          <div className="eyebrow" style={{marginBottom:8}}>By target system</div>
          {Object.entries(byTarget).map(([t,n]) => (
            <button key={t} onClick={() => setTargetFilter(targetFilter === t ? null : t)}
              style={{display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center",
                padding:"6px 8px", borderRadius:6, marginBottom:2, fontSize:12,
                background: targetFilter === t ? "var(--accent-bg)" : "transparent",
                color: targetFilter === t ? "var(--cta)" : "var(--ink-secondary)",
                fontWeight: targetFilter === t ? 600 : 500}}>
              <span className={"sys-pill " + t.toLowerCase()}>{t}</span>
              <span className="muted tt">{n}</span>
            </button>
          ))}
          {(agentFilter || targetFilter) && (
            <button className="btn ghost sm" style={{marginTop:12, width:"100%", justifyContent:"center"}}
              onClick={() => { setAgentFilter(null); setTargetFilter(null); }}>
              Clear filters
            </button>
          )}
        </aside>
      ) : (
        <aside className="side-rail collapsed" style={{borderRight:"1px solid var(--line)", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0"}}>
          <button className="rail-toggle big" onClick={() => setLeftOpen(true)} title="Expand filters">›</button>
          <div style={{writingMode:"vertical-rl", transform:"rotate(180deg)", marginTop:14, fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--ink-muted)", fontWeight:600}}>
            Filters{agentFilter ? " · " + agentFilter : ""}{targetFilter ? " · " + targetFilter : ""}
          </div>
        </aside>
      )}

      {/* Main */}
      <div style={{display:"flex", flexDirection:"column", minHeight:0, position:"relative"}}>
        <div className="sh">
          <div>
            <div className="eyebrow">Initiatives</div>
            <h1 style={{whiteSpace:"nowrap"}}>{visibleInits.length} of 37 active</h1>
          </div>
          <div className="spacer"/>
          <div className="row" style={{gap:6}}>
            <VarTabs options={[{id:"board", label:"Board"},{id:"table", label:"Table"}]}
              value={variant} onChange={setVariant}/>
            <button className="btn ghost sm" onClick={() => { setLeftOpen(false); setRightOpen(false); }}
              title="Full-width board">⤢ Maximize</button>
          </div>
        </div>

        <div style={{flex:1, overflow:"auto", padding:16, position:"relative"}}>
          {variant === "board" ? (
            <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:10, height:"100%"}}>
              {cols.map(c => {
                const colInits = visibleInits.filter(i => i.col === c.id);
                return (
                  <div key={c.id} style={{display:"flex", flexDirection:"column", minHeight:0}}>
                    <div className="row" style={{justifyContent:"space-between", padding:"6px 10px"}}>
                      <div className="row" style={{gap:8}}>
                        <span className="eyebrow" style={{color: c.accent ? "var(--cta)" : "var(--ink-muted)"}}>{c.label}</span>
                        <span className="chip">{colInits.length}</span>
                      </div>
                      <button className="btn ghost sm"><I.plus size={11}/></button>
                    </div>
                    <div style={{flex:1, background:"var(--bg-subtle)", borderRadius:8, padding:8,
                      border:"1px solid var(--line)", overflow:"auto",
                      ...(c.id === "todo" ? {borderColor:"var(--accent-ring)"} : {})}}>
                      {colInits.map(i => {
                        const Ico = I[i.agent] || I.factory;
                        const isNew = ["INI-091","INI-092"].includes(i.id);
                        const target = i.target.toLowerCase();
                        const impact = impactChip(i.impact);
                        const dueCls = dueClass(i.due);
                        const isSel = selected === i.id;
                        return (
                          <div key={i.id} className="card"
                            onClick={() => { setSelected(i.id); if (!rightOpen) setRightOpen(true); }}
                            style={{padding:"8px 10px", marginBottom:6, cursor:"pointer",
                              border: isSel ? "1.5px solid var(--cta)" : isNew ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                              background: isSel ? "var(--accent-bg)" : isNew ? "var(--accent-bg)" : "var(--bg-surface)"}}>
                            <div className="row" style={{justifyContent:"space-between", marginBottom:4, gap:6}}>
                              <span className="mono tt muted" style={{whiteSpace:"nowrap"}}>{i.id}</span>
                              <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                 className="mono tt"
                                 style={{color:"var(--cta)", fontWeight:600, textDecoration:"none", whiteSpace:"nowrap"}}>
                                ← {incidentFor(i.id)}
                              </a>
                            </div>
                            <div style={{fontSize:12, fontWeight:500, lineHeight:1.3, marginBottom:8, overflowWrap:"anywhere", wordBreak:"break-word"}}>{i.title}</div>
                            <div className="row" style={{justifyContent:"space-between", marginBottom:4}}>
                              <span className={"sys-pill " + target}>{i.target}</span>
                              <span className="row" style={{gap:6}}>
                                <Ico size={12} color="var(--ink-muted)"/>
                                <span className="avatar" style={{width:16, height:16, fontSize:8}}>{i.owner}</span>
                                <span className={"due " + dueCls} style={{fontSize:11}}>{i.due}</span>
                              </span>
                            </div>
                            {impact && (
                              <div className="ai-block" style={{fontSize:10.5, paddingTop:3, marginTop:3, borderTop:"1px dashed var(--line)"}}>
                                <span className="ai-tag" style={{marginRight:3}}/>
                                <span style={{color:"var(--ink-secondary)"}}>{impact.label}</span>
                              </div>
                            )}
                            {isNew && !isSel && (
                              <div className="tt" style={{marginTop:4, color:"var(--cta)", fontWeight:600}}>
                                ✦ just dispatched
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="panel">
              <table style={{width:"100%", fontSize:12, borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{color:"var(--ink-muted)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase"}}>
                    {["ID","Incident","Title","Agent","Target","Owner","Due","Status","Impact"].map(h => (
                      <th key={h} style={{padding:"10px 14px", textAlign:"left"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleInits.map(i => {
                    const Ico = I[i.agent] || I.factory;
                    return (
                      <tr key={i.id} onClick={() => { setSelected(i.id); if (!rightOpen) setRightOpen(true); }}
                        style={{borderTop:"1px solid var(--line)", cursor:"pointer",
                          background: selected === i.id ? "var(--accent-bg)" : "transparent"}}>
                        <td style={{padding:"8px 14px", whiteSpace:"nowrap"}} className="mono muted">{i.id}</td>
                        <td style={{padding:"8px 14px"}}><a href="#" onClick={(e)=>{e.preventDefault(); e.stopPropagation();}} className="mono tt" style={{color:"var(--cta)", fontWeight:600, textDecoration:"none", whiteSpace:"nowrap"}}>{incidentFor(i.id)}</a></td>
                        <td style={{padding:"8px 14px", fontWeight:500}}>{i.title}</td>
                        <td style={{padding:"8px 14px"}}><Ico size={12}/></td>
                        <td style={{padding:"8px 14px"}}><span className={"sys-pill " + i.target.toLowerCase()}>{i.target}</span></td>
                        <td style={{padding:"8px 14px"}}>{i.owner}</td>
                        <td style={{padding:"8px 14px"}} className={"due " + dueClass(i.due)}>{i.due}</td>
                        <td style={{padding:"8px 14px"}}><span className="chip">{i.col}</span></td>
                        <td style={{padding:"8px 14px"}} className="muted">{i.impact}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {showAnno && leftOpen && rightOpen && (
            <>
              <Anno tag="IN1 · Collapsible rails" style={{left:20, top:12, maxWidth:220}}>
                Filter rail + detail drawer both collapse — same pattern as Inbox for consistency.
              </Anno>
              <Anno tag="IN2 · Fresh dispatch" style={{left:20, top:100}}>
                Blue-bordered cards in "To do" = just-dispatched from Resolve. Click any card to open detail drawer.
              </Anno>
              <Anno tag="IN3 · System pills" style={{left:220, top:180, maxWidth:200}}>
                Jira / MES / SRM tags as colored pills — "closed-loop into real systems" is the pitch.
              </Anno>
            </>
          )}
        </div>
      </div>

      {/* Right detail drawer */}
      {rightOpen ? (
        <aside className="side-rail" style={{borderLeft:"1px solid var(--line)", padding:"14px 16px", overflow:"auto", background:"#fff"}}>
          <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
            <div className="eyebrow">Detail</div>
            <button className="rail-toggle" onClick={() => setRightOpen(false)} title="Collapse detail">›</button>
          </div>
          {selectedInit ? (
            <>
              <div className="row" style={{gap:8, marginBottom:4}}>
                <span className="mono tt muted" style={{whiteSpace:"nowrap"}}>{selectedInit.id}</span>
                <a href="#" onClick={(e)=>e.preventDefault()} className="mono tt" style={{color:"var(--cta)", fontWeight:600, textDecoration:"none", whiteSpace:"nowrap"}}>← {incidentFor(selectedInit.id)}</a>
              </div>
              <div style={{fontSize:15, fontWeight:600, lineHeight:1.35, marginBottom:10}}>{selectedInit.title}</div>

              <div className="row" style={{gap:6, marginBottom:12, flexWrap:"wrap"}}>
                <span className={"sys-pill " + selectedInit.target.toLowerCase()}>{selectedInit.target}</span>
                <span className="chip">{selectedInit.col}</span>
                <span className={"due " + dueClass(selectedInit.due)} style={{fontSize:11, padding:"2px 8px", borderRadius:999, background:"var(--bg-inset)"}}>{selectedInit.due}</span>
              </div>

              <div className="ai-block" style={{marginBottom:14}}>
                <div className="ai-tag" style={{marginBottom:4}}>Projected impact</div>
                <div style={{fontSize:12, lineHeight:1.5, color:"var(--ink-secondary)"}}>
                  {selectedInit.impact}
                </div>
              </div>

              <div className="eyebrow" style={{marginBottom:6}}>Agent</div>
              <div className="card" style={{padding:10, marginBottom:12, background:"var(--bg-subtle)"}}>
                <div className="row" style={{gap:8}}>
                  {(() => { const Ico = I[selectedInit.agent] || I.factory; return <Ico size={14}/>; })()}
                  <span style={{fontSize:12, fontWeight:600}}>{selectedInit.agent}</span>
                </div>
              </div>

              <div className="eyebrow" style={{marginBottom:6}}>Owner</div>
              <div className="row" style={{gap:8, marginBottom:14}}>
                <div className="avatar" style={{width:24, height:24, fontSize:10}}>{selectedInit.owner}</div>
                <div style={{fontSize:12}}>Quality engineer</div>
              </div>

              <button className="btn primary" style={{width:"100%", justifyContent:"center"}}
                onClick={() => setRoute("canvas")}>
                Open incident canvas →
              </button>
            </>
          ) : (
            <div className="muted" style={{textAlign:"center", marginTop:40, padding:"0 6px", fontSize:11, lineHeight:1.5, whiteSpace:"normal"}}>
              Click a card to see its detail, AI impact projection, and agent assignment.
            </div>
          )}
        </aside>
      ) : (
        <aside className="side-rail collapsed" style={{borderLeft:"1px solid var(--line)", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0"}}>
          <button className="rail-toggle big" onClick={() => setRightOpen(true)} title="Expand detail">‹</button>
          <div style={{writingMode:"vertical-rl", marginTop:14, fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--ink-muted)", fontWeight:600}}>
            Detail
          </div>
        </aside>
      )}
    </div>
  );
}
window.InitiativesScreen = InitiativesScreen;

// ============ LESSONS ============
function LessonsScreen() {
  const { showAnno } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("less.var") || "masonry");
  const [activeTag, setActiveTag] = React.useState(null);
  React.useEffect(() => { localStorage.setItem("less.var", variant); }, [variant]);

  // Distinct tags per lesson
  const TAGS = {
    "LES-018": ["solder", "supplier", "SB-00007"],
    "LES-022": ["thermal", "R33", "PM-00012"],
    "LES-014": ["torque", "calibration", "Stn-04"],
    "LES-031": ["rework", "operator", "shift-2"],
    "LES-009": ["label", "printer", "L3"],
    "LES-027": ["EOL", "near-miss", "SPC"],
  };

  const Spark = ({data, color="var(--sev-low)", recurring=false}) => {
    const max = Math.max(...data, 1);
    const pts = data.map((v,i) => `${(i/(data.length-1))*100},${100 - (v/max)*80 - 10}`);
    const c = recurring ? "var(--amber)" : color;
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:"100%", height:40}}>
        <polygon fill={c} opacity="0.25"
          points={`0,100 ${pts.join(" ")} 100,100`}/>
        <polyline fill="none" stroke={c} strokeWidth="2.5"
          points={pts.join(" ")}/>
      </svg>
    );
  };

  // Header stats
  const totalApplied = DATA.lessons.reduce((s,L) => s + L.applied, 0);
  const totalLessons = 324;

  // All tags for filter
  const allTags = Array.from(new Set(Object.values(TAGS).flat()));

  return (
    <div style={{display:"flex", flexDirection:"column", height:"calc(100vh - 52px)"}}>
      <div className="sh">
        <div>
          <div className="eyebrow">Network library</div>
          <h1>Lessons</h1>
        </div>
        <div className="spacer"/>
        <div className="cmdk" style={{minWidth:360}}>
          <I.search size={12}/>
          <span>Search by symptom, part, supplier, fix…</span>
        </div>
        <VarTabs options={[{id:"masonry", label:"Masonry"},{id:"list", label:"List"}]}
          value={variant} onChange={setVariant}/>
      </div>

      {/* Header stat line + tag filters */}
      <div style={{padding:"14px 24px 10px", background:"#fff", borderBottom:"1px solid var(--line)"}}>
        <div className="row" style={{gap:24, marginBottom:12}}>
          <div className="ai-block">
            <div className="ai-tag" style={{marginBottom:2}}>Network effect</div>
            <div style={{fontSize:14}}>
              <b style={{fontSize:18, color:"var(--cta)"}}>{totalLessons}</b> lessons ·{" "}
              applied <b>{totalApplied.toLocaleString()}×</b> ·{" "}
              across <b>{DATA.plants.length} plants</b>
            </div>
          </div>
          <div className="spacer"/>
        </div>
        <div className="row" style={{gap:6, flexWrap:"wrap"}}>
          <span className="eyebrow" style={{marginRight:4}}>Filters:</span>
          {allTags.slice(0,9).map(t => (
            <button key={t} onClick={() => setActiveTag(activeTag === t ? null : t)}
              className="chip"
              style={{
                cursor:"pointer",
                background: activeTag === t ? "var(--cta)" : "var(--bg-inset)",
                color: activeTag === t ? "#fff" : "var(--ink-secondary)",
                borderColor: activeTag === t ? "var(--cta)" : "var(--line)"
              }}>
              {t}
            </button>
          ))}
          {activeTag && (
            <button onClick={() => setActiveTag(null)} className="btn ghost sm">clear</button>
          )}
        </div>
      </div>

      <div style={{flex:1, overflow:"auto", padding:18, position:"relative"}}>
        <div style={{display:"grid",
          gridTemplateColumns: variant === "masonry" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr",
          gap:12}}>
          {DATA.lessons
            .filter(L => !activeTag || TAGS[L.id]?.includes(activeTag))
            .map(L => {
            const recurring = L.outcome === "recurring";
            const tags = TAGS[L.id] || ["general"];
            return (
              <div key={L.id} className="card" style={{padding:14,
                borderTop: recurring ? "2px solid var(--amber)" : "1px solid var(--line)"}}>
                <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
                  <span className="eyebrow mono" style={{color:"var(--cta)"}}>⚡ {L.id}</span>
                  <span className={"chip " + (recurring ? "sev-med" : "sev-low")}>
                    <span className="dot" style={{background: recurring ? "var(--amber)" : "var(--sev-low)"}}/>
                    {L.outcome}
                  </span>
                </div>
                <div style={{fontSize:13, fontWeight:600, lineHeight:1.35, marginBottom:6}}>{L.sig}</div>
                <div className="muted" style={{fontSize:12, lineHeight:1.5, marginBottom:10}}>{L.fix}</div>
                <div className="row" style={{gap:5, marginBottom:10, flexWrap:"wrap"}}>
                  {tags.map(t => (
                    <span key={t} className="chip" style={{fontSize:10, padding:"1px 7px"}}>{t}</span>
                  ))}
                </div>
                <div className="row" style={{justifyContent:"space-between", fontSize:11}}>
                  <span style={{color:"var(--cta)", fontWeight:700}}>
                    Applied {L.applied}× · {L.plants} plants
                  </span>
                  <span className="muted tt">→ INC-00001</span>
                </div>
                <Spark data={L.trend} recurring={recurring}/>
                <div className="muted tt" style={{textAlign:"center", marginTop:-2}}>
                  recurrence after applied (8w)
                </div>
              </div>
            );
          })}
        </div>
        {showAnno && (
          <>
            <Anno tag="LE1 · Header stat" style={{left:20, top:12, maxWidth:240}}>
              324 lessons · applied 1,842× · 12 plants — the network-effect punchline, now explicit with AI provenance bar.
            </Anno>
            <Anno tag="LE2 · Distinct tags" style={{left:20, top:120, maxWidth:220}}>
              Every card gets unique tags (solder/thermal/torque/rework/label/near-miss), not the same three each time.
            </Anno>
            <Anno tag="LE3 · Recurring border" style={{right:20, top:200, maxWidth:220}}>
              Recurring lessons (LES-031) get a 2px amber top border — visually flagged as "this one needs attention" without re-reading.
            </Anno>
            <Anno tag="LE4 · Thicker sparkline" style={{right:20, top:340, maxWidth:220}}>
              2.5px stroke + filled area. The downward slope is the product's value prop — no longer whispered.
            </Anno>
          </>
        )}
      </div>
    </div>
  );
}
window.LessonsScreen = LessonsScreen;

// ============ CONNECTORS ============
function ConnectorsScreen() {
  const { showAnno } = useApp();

  // Brand-tinted icon wrapper per kind
  const brandFor = (name, kind) => {
    const n = name.toLowerCase();
    if (n.includes("jira")) return { bg:"rgba(16,50,207,0.12)", fg:"var(--cta)", letter:"J" };
    if (n.includes("mes")) return { bg:"rgba(244,138,92,0.14)", fg:"#b3551f", letter:"M" };
    if (n.includes("srm")) return { bg:"rgba(138,111,230,0.14)", fg:"#5d49a6", letter:"S" };
    if (n.includes("erp") || n.includes("wms")) return { bg:"rgba(99,159,196,0.18)", fg:"var(--accent-dim)", letter:"E" };
    if (n.includes("crm") || n.includes("warranty")) return { bg:"rgba(95,194,163,0.18)", fg:"#1e7a58", letter:"W" };
    if (n.includes("fmea")) return { bg:"rgba(138,111,230,0.14)", fg:"#5d49a6", letter:"F" };
    if (n.includes("rework")) return { bg:"rgba(244,138,92,0.14)", fg:"#b3551f", letter:"R" };
    if (n.includes("voice")) return { bg:"rgba(99,159,196,0.18)", fg:"var(--accent-dim)", letter:"V" };
    if (n.includes("dealer")) return { bg:"rgba(95,194,163,0.18)", fg:"#1e7a58", letter:"D" };
    if (n.includes("nps") || n.includes("cx")) return { bg:"rgba(16,50,207,0.10)", fg:"var(--cta)", letter:"N" };
    if (n.includes("iot")) return { bg:"rgba(99,159,196,0.18)", fg:"var(--accent-dim)", letter:"◎" };
    if (n.includes("social")) return { bg:"rgba(232,104,166,0.14)", fg:"#a03668", letter:"#" };
    if (n.includes("call")) return { bg:"rgba(138,111,230,0.14)", fg:"#5d49a6", letter:"☎" };
    if (n.includes("eol") || n.includes("end-of")) return { bg:"rgba(95,194,163,0.18)", fg:"#1e7a58", letter:"◉" };
    if (n.includes("spc")) return { bg:"rgba(244,138,92,0.14)", fg:"#b3551f", letter:"σ" };
    if (n.includes("supplier") || n.includes("inbound")) return { bg:"rgba(99,159,196,0.18)", fg:"var(--accent-dim)", letter:"⇥" };
    if (n.includes("maintenance")) return { bg:"rgba(224,165,58,0.14)", fg:"#9a6b14", letter:"⚙" };
    return { bg:"var(--bg-inset)", fg:"var(--ink-secondary)", letter:name[0] };
  };

  // Augment connectors with two External-Customer placeholders
  const augmented = DATA.connectors.map(g => {
    if (g.group === "External — Customer") {
      return { ...g, items: [...g.items,
        { name:"Customer Reviews", status:"partial", sigs:42, last:"18 min ago", kind:"mail" },
        { name:"Support Tickets",  status:"connected", sigs:28, last:"12 min ago", kind:"mail" },
      ]};
    }
    return g;
  });

  // Sub-categorize into finer groups (by item name → sub-label)
  const subcategoryOf = (groupName, itemName) => {
    const n = itemName.toLowerCase();
    if (groupName === "Internal — Production") {
      if (n.includes("mes") || n.includes("spc")) return "Machines & test benches";
      if (n.includes("voice") || n.includes("rework")) return "People & behavior";
      if (n.includes("maint") || n.includes("fmea")) return "Process records";
    }
    if (groupName === "Internal — Supply Chain") {
      if (n.includes("supplier") || n.includes("inbound")) return "Inbound quality";
      if (n.includes("srm") || n.includes("erp") || n.includes("wms")) return "Systems of record";
    }
    if (groupName === "External — Customer") {
      if (n.includes("warranty") || n.includes("iot")) return "Warranty & telemetry";
      if (n.includes("dealer") || n.includes("support") || n.includes("reviews")) return "Service channels";
      if (n.includes("nps") || n.includes("survey")) return "Voice of customer";
    }
    if (groupName === "External — Market") {
      if (n.includes("social")) return "Digital listening";
      if (n.includes("call")) return "Call-center";
    }
    return "Other";
  };

  // Top-level icon + tint per group
  const groupStyle = (name) => {
    if (name.startsWith("Internal — Production")) return { color:"var(--accent-dim)", bg:"rgba(99,159,196,0.06)", icon:"factory" };
    if (name.startsWith("Internal — Supply"))     return { color:"#b3551f",            bg:"rgba(244,138,92,0.06)", icon:"truck" };
    if (name.startsWith("External — Customer"))   return { color:"#5d49a6",            bg:"rgba(138,111,230,0.06)", icon:"users" };
    if (name.startsWith("External — Market"))     return { color:"#1e7a58",            bg:"rgba(95,194,163,0.06)", icon:"wave" };
    return { color:"var(--ink-secondary)", bg:"var(--bg-subtle)", icon:"factory" };
  };

  return (
    <div style={{display:"flex", flexDirection:"column", height:"calc(100vh - 52px)"}}>
      <div className="sh">
        <div>
          <div className="eyebrow">Signal sources</div>
          <h1>Connectors</h1>
        </div>
        <div className="spacer"/>
        <div className="row" style={{gap:10}}>
          <span className="chip" style={{color:"var(--cta)", borderColor:"var(--accent-ring)", background:"var(--accent-bg)"}}>
            <span className="dot" style={{background:"var(--cta)"}}/>14 connected
          </span>
          <span className="chip" style={{color:"#9a6b14", background:"rgba(224,165,58,0.14)", borderColor:"rgba(224,165,58,0.3)"}}>
            <span className="dot" style={{background:"var(--amber)"}}/>4 partial
          </span>
          <span className="chip">1 disconnected</span>
          <button className="btn primary" style={{fontWeight:600}}>
            <I.plus size={12}/> Add source
          </button>
        </div>
      </div>
      <div style={{flex:1, overflow:"auto", padding:20, position:"relative"}}>
        {augmented.map(g => {
          // Split items into sub-groups
          const subs = {};
          g.items.forEach(item => {
            const s = subcategoryOf(g.group, item.name);
            if (!subs[s]) subs[s] = [];
            subs[s].push(item);
          });
          const subOrder = Object.keys(subs);
          const gs = groupStyle(g.group);
          const GIco = I[gs.icon] || I.factory;
          return (
            <section key={g.group} style={{marginBottom:22, borderRadius:12, border:"1px solid var(--line)",
              background:gs.bg, overflow:"hidden"}}>
              <header className="row" style={{padding:"12px 16px", gap:10, borderBottom:"1px solid var(--line)",
                background:"#fff"}}>
                <div style={{width:28, height:28, borderRadius:7, display:"flex",
                  alignItems:"center", justifyContent:"center", background:gs.bg, color:gs.color,
                  border:`1px solid ${gs.color}33`}}>
                  <GIco size={14} color={gs.color}/>
                </div>
                <div style={{fontSize:14, fontWeight:600, color:gs.color}}>{g.group}</div>
                <span className="chip" style={{marginLeft:4}}>{g.items.length} sources</span>
                <div className="spacer"/>
                <span className="tt muted">{subOrder.length} categor{subOrder.length === 1 ? "y" : "ies"}</span>
              </header>
              <div style={{padding:14}}>
                {subOrder.map((sub, si) => (
                  <div key={sub} style={{marginBottom: si === subOrder.length - 1 ? 0 : 14}}>
                    <div className="row" style={{gap:8, marginBottom:8, paddingLeft:2, whiteSpace:"nowrap"}}>
                      <span style={{width:3, height:12, background:gs.color, borderRadius:2, opacity:0.5, flexShrink:0}}/>
                      <span className="eyebrow" style={{color:gs.color, opacity:0.9, whiteSpace:"nowrap"}}>{sub}</span>
                      <span className="muted tt" style={{whiteSpace:"nowrap"}}>· {subs[sub].length}</span>
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:8}}>
                      {subs[sub].map(c => {
                        const brand = brandFor(c.name, c.kind);
                        const statusColor = c.status === "connected" ? "var(--sev-low)" : c.status === "partial" ? "var(--amber)" : "var(--ink-muted)";
                        return (
                          <div key={c.name} className="card" style={{padding:12, background:"var(--bg-surface)"}}>
                            <div className="row" style={{justifyContent:"space-between"}}>
                              <div style={{
                                width:32, height:32, borderRadius:7, background:brand.bg,
                                color:brand.fg, fontWeight:700, fontSize:14,
                                display:"flex", alignItems:"center", justifyContent:"center"
                              }}>{brand.letter}</div>
                              <span className="row" style={{gap:4}}>
                                <span style={{width:6, height:6, borderRadius:3, background:statusColor,
                                  animation: c.status === "connected" ? "pulse 2s infinite" : "none"}}/>
                                <span className="tt" style={{color:statusColor, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em", fontSize:10}}>{c.status}</span>
                              </span>
                            </div>
                            <div style={{fontSize:12.5, fontWeight:600, margin:"9px 0 2px", lineHeight:1.3}}>{c.name}</div>
                            <div className="row" style={{justifyContent:"space-between"}}>
                              <span style={{fontSize:10, color:"var(--ink-faint)"}}>{c.sigs} signals · {c.last}</span>
                              {c.status === "partial" && (
                                <a href="#" onClick={(e)=>e.preventDefault()}
                                   style={{fontSize:10, color:"var(--cta)", fontWeight:600, textDecoration:"none"}}>
                                  Details →
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {showAnno && (
          <>
            <Anno tag="CN1 · Branded icons" style={{left:20, top:60, maxWidth:220}}>
              Each connector gets a branded color-tinted tile. Jira blue, MES orange, SRM purple — instantly distinguishable.
            </Anno>
            <Anno tag="CN2 · Add source" style={{right:20, top:-40, maxWidth:200}}>
              Promoted to filled primary CTA — this IS the page's main action.
            </Anno>
            <Anno tag="CN3 · Partial drill" style={{right:20, top:260, maxWidth:220}}>
              Partial status now has "View details →" to drill into what's missing.
            </Anno>
          </>
        )}
      </div>
    </div>
  );
}
window.ConnectorsScreen = ConnectorsScreen;

// ============ LEADERSHIP ============
function LeadershipScreen() {
  const { showAnno } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("lead.var") || "exec");
  React.useEffect(() => { localStorage.setItem("lead.var", variant); }, [variant]);

  const max = Math.max(...DATA.pareto.map(p => p.cost));

  const Spark = ({data, color="var(--ink-muted)"}) => (
    <svg viewBox="0 0 80 22" preserveAspectRatio="none" style={{width:"100%", height:22}}>
      <polyline fill="none" stroke={color} strokeWidth="1.5"
        points={data.map((v,i) => `${(i/(data.length-1))*80},${22 - (v*3)}`).join(" ")}/>
    </svg>
  );

  // Heatmap with REAL fill scaling
  const plantZones = [
    {name:"Montage Linie 1", n:17, hot:true},
    {name:"Montage Linie 2", n:5},
    {name:"Pruefung Linie 1", n:4},
    {name:"Pruefung Linie 2", n:12, bias:true},
    {name:"Packaging",       n:2},
    {name:"EOL Test",        n:8},
  ];
  const maxN = Math.max(...plantZones.map(z => z.n));
  const heatFill = (n, isHot) => {
    const t = n / maxN;
    if (isHot) return `rgba(244,138,92,${0.12 + t*0.35})`;
    return `rgba(99,159,196,${0.08 + t*0.35})`;
  };

  // Initiative counts with proportional strips
  const initCounts = [
    {name:"To do", n:8, accent:true},
    {name:"In progress", n:14, hero:true},
    {name:"Blocked", n:3, bad:true},
    {name:"Verifying", n:7},
    {name:"Closed", n:5},
  ];
  const maxInit = Math.max(...initCounts.map(i => i.n));

  return (
    <div style={{display:"flex", flexDirection:"column", height:"calc(100vh - 52px)"}}>
      <div className="sh">
        <div>
          <div className="eyebrow">Leadership lens · {DATA.user.plant}</div>
          <h1>Quality at a glance</h1>
        </div>
        <div className="spacer"/>
        <VarTabs options={[{id:"exec", label:"Exec"},{id:"dense", label:"Dense"}]}
          value={variant} onChange={setVariant}/>
      </div>

      <div style={{flex:1, overflow:"auto", padding:18, position:"relative"}}>
        {/* Top metrics with correct delta semantics (CC4) */}
        <div className="panel" style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", marginBottom:16}}>
          {[
            {label:"Open incidents", value:14, delta:"↑ 3 vs 7d", cls:"bad", data:[1,2,3,4,5,6,5,7], accent:true},
            {label:"€ at risk", value:"€312k", delta:"↓ 8% vs 7d", cls:"good", data:[7,6,5,5,4,4,3,3]},
            {label:"Avg time-to-close", value:"3.4d", delta:"↓ 0.8d vs 30d", cls:"good", data:[5,5,4,4,3,3,3,3]},
            {label:"Claims avoided · Q2", value:"84", delta:"↑ 28 vs Q1", cls:"good", data:[3,4,5,5,6,7,8,9]},
          ].map((m,i) => (
            <div key={i} className="metric" style={{borderRight: i<3 ? "1px solid var(--line)" : "none"}}>
              <span className="label">{m.label}</span>
              <span className={"value " + (m.accent ? "accent" : "")}>{m.value}</span>
              <div className="row" style={{justifyContent:"space-between"}}>
                <span className={"delta " + m.cls}>{m.delta}</span>
                <Spark data={m.data} color={m.accent ? "var(--cta)" : "var(--ink-muted)"}/>
              </div>
            </div>
          ))}
        </div>

        {/* Pareto + Plant heatmap */}
        <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, marginBottom:16}}>
          <div className="panel" style={{padding:18}}>
            <div className="eyebrow" style={{marginBottom:6}}>Incident Pareto · by cost impact</div>
            <div style={{fontSize:14, fontWeight:600, marginBottom:14}}>Top drivers, last 30 days</div>
            {DATA.pareto.map((p,i) => (
              <div key={p.code} className="row" style={{gap:10, marginBottom:8}}>
                <span style={{width:200, fontSize:12, fontWeight: p.primary ? 600 : 500}}>{p.code}</span>
                <div style={{flex:1, height:14, background:"var(--bg-inset)", borderRadius:3, overflow:"hidden"}}>
                  <div style={{width: (p.cost / max * 100) + "%", height:"100%",
                    background: p.primary ? "var(--cta)" : "#94A3B8"}}/>
                </div>
                <span className="mono tt" style={{width:50, textAlign:"right",
                  color: p.primary ? "var(--cta)" : "var(--ink-muted)",
                  fontWeight: p.primary ? 700 : 500}}>€{p.cost}k</span>
              </div>
            ))}
          </div>
          <div className="panel" style={{padding:18, position:"relative"}}>
            <div className="eyebrow" style={{marginBottom:6}}>Plant heatmap · Werk München</div>
            <div style={{fontSize:14, fontWeight:600, marginBottom:14}}>Linien · incident density</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
              {plantZones.map(z => (
                <div key={z.name} style={{
                  padding:10,
                  background: z.bias ? "rgba(224,165,58,0.12)" : heatFill(z.n, z.hot),
                  border: "1px solid " + (z.bias ? "rgba(224,165,58,0.4)" : z.hot ? "rgba(244,138,92,0.35)" : "var(--line)"),
                  borderRadius:6, minHeight:80,
                  position:"relative"
                }}>
                  <div style={{fontSize:11, fontWeight:600, color:"var(--ink-primary)"}}>{z.name}</div>
                  <div style={{fontSize:20, fontWeight:700, color: z.hot ? "var(--sev-high)" : z.bias ? "#9a6b14" : "var(--ink-primary)", marginTop:4, lineHeight:1}}>
                    {z.n}
                  </div>
                  <div className="muted tt" style={{marginTop:2}}>incidents</div>
                  {z.bias && (
                    <div className="mono" style={{fontSize:9, color:"#9a6b14", marginTop:6, fontStyle:"italic", lineHeight:1.3}}>
                      * detection bias — not a root cause
                    </div>
                  )}
                </div>
              ))}
            </div>
            {showAnno && (
              <Anno tag="LD1 · Honest annotation" style={{left:-250, top:140, maxWidth:220}}>
                "Detection bias" callout on Pruefung Linie 2 — we flag our own artifact so leaders don't chase ghosts.
              </Anno>
            )}
            {showAnno && (
              <Anno tag="LD2 · Real heatmap" style={{right:-240, top:60, maxWidth:220}}>
                Fill opacity now scales with incident count. Linie 1 (17) reads hot, Packaging (2) barely tints.
              </Anno>
            )}
          </div>
        </div>

        {/* Cross-plant map (Europe stylized) + initiatives */}
        <div style={{display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16}}>
          <div className="panel" style={{padding:18}}>
            <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
              <div className="eyebrow">Cross-plant incidents · Europe heatmap</div>
              <div className="row" style={{gap:10}}>
                <span className="mono tt muted">Low</span>
                {[0.12, 0.3, 0.55, 0.78, 1].map((op,i) => (
                  <span key={i} style={{width:14, height:10, background:`rgba(244,138,92,${op})`, borderRadius:2}}/>
                ))}
                <span className="mono tt muted">High</span>
              </div>
            </div>
            <div style={{fontSize:14, fontWeight:600, marginBottom:14}}>Incidents per plant, last 30 days</div>
            {(() => {
              // Country grid (rows approximate latitude). Each cell = country code;
              // plants sit inside their country and carry the heat value.
              const plants = {
                "UK":  {count:2, plant:"Birmingham"},
                "NL":  {count:5, plant:"Eindhoven"},
                "DE-N":{count:6, plant:"Hamburg"},
                "PL":  {count:4, plant:"Wrocław"},
                "FR":  {count:3, plant:"Lyon"},
                "DE-S":{count:14, plant:"München", hot:true},
                "CZ":  {count:7, plant:"Brno"},
                "AT":  {count:2, plant:"Graz"},
                "RO":  {count:3, plant:"Cluj"},
                "ES":  {count:9, plant:"Valencia"},
                "IT":  {count:5, plant:"Torino"},
                "HU":  {count:4, plant:"Győr"},
              };
              const others = ["IE","BE","DK","SE","SK","CH","SI","HR","BG","PT","GR"];
              // 4-row grid laid out to roughly echo Europe's geography
              const grid = [
                [null, null, "UK",  null, "NL",  "DE-N","PL",  null, null],
                [null, "IE", null,  "BE", "DE-S","CZ",  "SK",  null, null],
                [null, null, "FR",  "CH", "AT",  "HU",  "RO",  null, null],
                ["PT", "ES", null,  "IT", "SI",  "HR",  "BG",  null, null],
              ];
              const maxCount = Math.max(...Object.values(plants).map(p => p.count));
              return (
                <div style={{display:"grid", gridTemplateRows:"repeat(4, 54px)", gap:4,
                  background:"var(--bg-subtle)", padding:10, borderRadius:8, border:"1px solid var(--line)"}}>
                  {grid.map((row, ri) => (
                    <div key={ri} style={{display:"grid", gridTemplateColumns:"repeat(9, 1fr)", gap:4}}>
                      {row.map((code, ci) => {
                        if (!code) return <div key={ci}/>;
                        const p = plants[code];
                        if (p) {
                          const t = p.count / maxCount;
                          const op = 0.12 + t * 0.78;
                          return (
                            <div key={ci} style={{
                              borderRadius:4, padding:"4px 5px",
                              background: p.hot ? `rgba(239,93,58,${op})` : `rgba(244,138,92,${op})`,
                              border: p.hot ? "1.5px solid var(--sev-high)" : "1px solid rgba(244,138,92,0.3)",
                              display:"flex", flexDirection:"column", justifyContent:"space-between", minWidth:0
                            }}>
                              <span className="mono" style={{fontSize:8, letterSpacing:"0.05em",
                                color: t > 0.5 ? "#fff" : "var(--ink-secondary)", fontWeight:700,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{p.plant}</span>
                              <span className="mono" style={{fontSize: p.hot ? 16 : 13, fontWeight:700,
                                color: t > 0.5 ? "#fff" : "var(--ink-primary)"}}>{p.count}</span>
                            </div>
                          );
                        }
                        // non-plant country — muted tile
                        return (
                          <div key={ci} style={{
                            borderRadius:4, background:"rgba(99,159,196,0.08)",
                            border:"1px solid rgba(99,159,196,0.15)",
                            display:"flex", alignItems:"center", justifyContent:"center"
                          }}>
                            <span className="mono" style={{fontSize:9, color:"var(--ink-muted)", fontWeight:600}}>{code}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="row" style={{justifyContent:"space-between", marginTop:10, fontSize:11, color:"var(--ink-muted)"}}>
              <span>12 plants · 9 countries</span>
              <span className="mono" style={{color:"var(--sev-high)", fontWeight:600}}>München outlier: 14 incidents</span>
            </div>
          </div>
          <div className="panel" style={{padding:18}}>
            <div className="eyebrow" style={{marginBottom:6}}>Open initiatives</div>
            <div style={{fontSize:14, fontWeight:600, marginBottom:14}}>37 across 5 swimlanes</div>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              {initCounts.map(l => (
                <div key={l.name} className="row" style={{gap:10}}>
                  <span style={{width:82, fontSize:12, color:"var(--ink-secondary)"}}>{l.name}</span>
                  <div style={{flex:1, height:20, background:"var(--bg-inset)", borderRadius:3, overflow:"hidden", position:"relative"}}>
                    <div style={{
                      width: (l.n / maxInit * 100) + "%", height:"100%",
                      background: l.bad ? "var(--sev-crit)" : l.hero ? "var(--cta)" : l.accent ? "var(--accent)" : "#94A3B8"
                    }}/>
                  </div>
                  <span className="mono" style={{width:28, textAlign:"right", fontWeight:700,
                    fontSize: l.hero ? 16 : 13,
                    color: l.bad ? "var(--sev-crit)" : l.hero ? "var(--cta)" : "var(--ink-primary)"}}>{l.n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {showAnno && (
          <>
            <Anno tag="LD3 · Pareto gray" style={{left:40, top:400, maxWidth:220}}>
              Non-top-3 bars now neutral gray (#94A3B8) — reads "present but deprioritized", not "disabled".
            </Anno>
            <Anno tag="LD4 · Proportional init strip" style={{right:20, top:540, maxWidth:220}}>
              14 In Progress visually dominates 3 Blocked. The story is told by bar length, not just the digit.
            </Anno>
          </>
        )}
      </div>
    </div>
  );
}
window.LeadershipScreen = LeadershipScreen;

// ============ FLOOR ============
function FloorScreen() {
  const { setLens, showAnno } = useApp();
  const [recording, setRecording] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [photos, setPhotos] = React.useState([]);
  const [selectedIssue, setSelectedIssue] = React.useState(null);
  const [variant, setVariant] = React.useState(() => localStorage.getItem("floor.var") || "classic");
  const fileRef = React.useRef(null);
  React.useEffect(() => { localStorage.setItem("floor.var", variant); }, [variant]);

  const submit = () => {
    setRecording(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setPhotos([]);
      setSelectedIssue(null);
    }, 4000);
  };

  const addPhoto = () => {
    // Simulated capture — add a placeholder tile
    setPhotos(p => [...p, { id: Date.now(), label: "Photo " + (p.length + 1) }]);
  };

  const ISSUES = [
    { id:"scratch", label:"Scratch / dent",     icon:"✦", color:"var(--sev-high)" },
    { id:"noise",   label:"Strange noise",      icon:"~", color:"var(--accent)" },
    { id:"batch",   label:"Batch looks off",    icon:"◆", color:"var(--cta)" },
    { id:"label",   label:"Wrong label",        icon:"▤", color:"var(--sev-med)" },
    { id:"heat",    label:"Heat warning",       icon:"△", color:"var(--sev-crit)" },
    { id:"other",   label:"Something else",     icon:"?", color:"var(--ink-muted)" },
  ];

  // Shared photo strip component
  const PhotoStrip = ({ small }) => (
    <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
      {photos.map(p => (
        <div key={p.id} style={{
          width: small ? 56 : 72, height: small ? 56 : 72, borderRadius: 10,
          background: "linear-gradient(135deg, #c4d4e2, #8fa8bf)",
          border: "1px solid var(--line)",
          position:"relative", flexShrink:0,
          display:"flex", alignItems:"flex-end", padding:6,
          fontSize:9, color:"#fff", fontWeight:600,
          boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.2)"
        }}>
          <span style={{textShadow:"0 1px 2px rgba(0,0,0,0.4)"}}>{p.label}</span>
          <button onClick={() => setPhotos(ph => ph.filter(x => x.id !== p.id))}
            style={{position:"absolute", top:3, right:3, width:18, height:18, borderRadius:"50%",
              background:"rgba(0,0,0,0.5)", color:"#fff", fontSize:10, border:"none",
              display:"flex", alignItems:"center", justifyContent:"center"}}>×</button>
        </div>
      ))}
      <button onClick={addPhoto}
        style={{
          width: small ? 56 : 72, height: small ? 56 : 72, borderRadius: 10,
          background: "#fff", border: "1.5px dashed var(--accent)", color:"var(--accent)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          gap:2, flexShrink:0, cursor:"pointer", fontSize: small ? 9 : 10
        }}>
        <div style={{fontSize: small ? 18 : 22, lineHeight:1}}>+</div>
        <div>Photo</div>
      </button>
    </div>
  );

  return (
    <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
      background:"#eef3f7", position:"relative"}}>

      {/* Floating controls */}
      <div style={{position:"absolute", top:16, right:16, display:"flex", gap:6, zIndex:10}}>
        <VarTabs options={[{id:"classic", label:"Tiles"},{id:"minimal", label:"Minimal"},{id:"chat", label:"Chat"}]}
          value={variant} onChange={setVariant}/>
        <button className="btn ghost sm" onClick={() => setLens("engineer")}>← exit floor lens</button>
      </div>

      {/* Phone frame */}
      <div style={{width:390, height:844, background:"#ffffff", borderRadius:40,
        border:"10px solid #1a1a1a", overflow:"hidden", position:"relative",
        boxShadow:"0 40px 80px rgba(16,50,207,0.25)"}}>

        {/* Status bar */}
        <div style={{height:44, padding:"0 22px", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:13, fontWeight:600, color:"var(--ink-primary)"}}>
          <span className="mono">{DATA.now}</span>
          <div style={{width:100, height:28, background:"#1a1a1a", borderRadius:20}}/>
          <span className="mono" style={{fontSize:11, letterSpacing:"0.04em"}}>●●● 82%</span>
        </div>

        {variant === "classic" && (
          <div style={{padding:"8px 20px 20px", overflow:"auto", height:"calc(100% - 44px)"}}>
            {/* Greeting */}
            <div className="row" style={{gap:10, marginBottom:18}}>
              <div style={{width:32, height:32, borderRadius:"50%", background:"var(--accent)", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700}}>M</div>
              <div>
                <div style={{fontSize:14, fontWeight:600}}>Hi Markus</div>
                <div className="muted tt">Montage Linie 1 · {DATA.shift}</div>
              </div>
            </div>

            <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em", marginBottom:4, color:"var(--ink-primary)"}}>
              What did you notice?
            </div>
            <div className="muted" style={{fontSize:13, marginBottom:16}}>Tap what fits, or hold the mic.</div>

            {/* Issue tiles — 2 cols of rounded squares */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18}}>
              {ISSUES.map(iss => {
                const on = selectedIssue === iss.id;
                return (
                  <button key={iss.id} onClick={() => setSelectedIssue(on ? null : iss.id)}
                    style={{
                      height: 60,
                      background: on ? "var(--accent-bg)" : "#ffffff",
                      border: on ? "2px solid var(--accent)" : "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "0 10px",
                      display:"flex", flexDirection:"row", alignItems:"center", gap:10,
                      textAlign:"left", cursor:"pointer",
                      boxShadow: on ? "0 3px 12px rgba(99,159,196,0.18)" : "0 1px 2px rgba(22,0,66,0.04)",
                      transition:"all 180ms"
                    }}>
                    <div style={{
                      width:32, height:32, borderRadius:8,
                      background: on ? iss.color : "var(--bg-subtle)",
                      color: on ? "#fff" : iss.color,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:16, fontWeight:700, flexShrink:0
                    }}>{iss.icon}</div>
                    <div style={{fontSize:12, fontWeight:600, color:"var(--ink-primary)", lineHeight:1.2}}>{iss.label}</div>
                  </button>
                );
              })}
            </div>

            {/* Photo capture */}
            <div style={{marginBottom:16}}>
              <div className="muted" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8}}>
                Add a photo (optional)
              </div>
              <PhotoStrip />
            </div>

            {/* Mic row */}
            <div style={{display:"flex", gap:10, alignItems:"center", marginBottom:14,
              padding:12, background:"var(--bg-subtle)", borderRadius:14, border:"1px solid var(--line)"}}>
              <button
                onMouseDown={() => setRecording(true)}
                onMouseUp={() => setRecording(false)}
                onTouchStart={() => setRecording(true)}
                onTouchEnd={() => setRecording(false)}
                style={{width:52, height:52, borderRadius:"50%",
                  background: recording ? "var(--cta)" : "var(--accent)",
                  color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                  border:"none", flexShrink:0, transition:"all 150ms",
                  boxShadow: recording ? "0 0 0 6px rgba(16,50,207,0.15)" : "0 4px 12px rgba(99,159,196,0.35)"}}>
                <I.mic size={22}/>
              </button>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:600}}>
                  {recording ? "Listening…" : "Hold to add voice note"}
                </div>
                <div className="muted tt" style={{marginTop:2}}>
                  {recording ? "…der dritte Kratzer in dieser Schicht…" : "Or type a quick note below"}
                </div>
              </div>
            </div>

            {/* Submit */}
            <button onClick={submit}
              disabled={!selectedIssue && photos.length === 0}
              style={{
                width:"100%", padding:"14px", borderRadius:12,
                background: (selectedIssue || photos.length) ? "var(--cta)" : "var(--bg-inset)",
                color: (selectedIssue || photos.length) ? "#fff" : "var(--ink-muted)",
                fontWeight:600, fontSize:14, border:"none",
                cursor: (selectedIssue || photos.length) ? "pointer" : "not-allowed"
              }}>
              Send report
            </button>

            {/* My reports */}
            <div style={{marginTop:22}}>
              <div className="muted" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8}}>
                My reports today
              </div>
              {DATA.floorReports.map((r,i) => {
                const color = r.status === "Resolved" ? "var(--sev-low)" : r.status === "Investigating" ? "var(--accent)" : "var(--ink-muted)";
                return (
                  <div key={i} className="card" style={{padding:10, marginBottom:6, borderRadius:10}}>
                    <div className="row" style={{justifyContent:"space-between"}}>
                      <div className="row" style={{gap:8}}>
                        <span style={{width:8, height:8, borderRadius:4, background:color}}/>
                        <span style={{fontSize:12, fontWeight:500}}>{r.text}</span>
                      </div>
                      <span className="muted tt">{r.time}</span>
                    </div>
                    <div className="muted tt" style={{marginLeft:16, marginTop:2, color}}>{r.status}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {variant === "minimal" && (
          <div style={{padding:"50px 22px", display:"flex", flexDirection:"column", alignItems:"center", height:"calc(100% - 44px)", overflow:"auto"}}>
            <div style={{fontSize:24, fontWeight:700, textAlign:"center", marginBottom:6, lineHeight:1.2, color:"var(--ink-primary)"}}>
              What did you notice?
            </div>
            <div className="muted" style={{textAlign:"center", marginBottom:36, fontSize:13}}>
              Just tell us. We'll handle the rest.
            </div>
            <button
              onMouseDown={() => setRecording(true)}
              onMouseUp={() => setRecording(false)}
              style={{width:200, height:200, borderRadius:"50%",
                background: recording ? "var(--cta)" : "var(--accent)", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"none",
                boxShadow: recording ? "0 0 0 10px rgba(16,50,207,0.15)" : "0 10px 40px rgba(99,159,196,0.40)",
                animation: recording ? "none" : "pulse 2.5s infinite",
                transition:"all 200ms"}}>
              <I.mic size={76}/>
            </button>
            <div className="muted" style={{marginTop:22, fontSize:12}}>
              {recording ? "Listening…" : "Tap & hold to talk"}
            </div>

            {/* Photo button, small */}
            <div style={{marginTop:28, width:"100%"}}>
              <div className="muted" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8, textAlign:"center"}}>
                or add a photo
              </div>
              <div style={{display:"flex", justifyContent:"center"}}>
                <PhotoStrip small />
              </div>
            </div>

            <div style={{marginTop:"auto", paddingTop:20, fontSize:12, color:"var(--ink-muted)"}}>
              Markus · Linie 1 · Shift 2
            </div>
          </div>
        )}

        {variant === "chat" && (
          <div style={{padding:"16px 16px", display:"flex", flexDirection:"column", height:"calc(100% - 44px)"}}>
            <div style={{fontSize:15, fontWeight:700, marginBottom:12}}>Report</div>
            <div className="card" style={{padding:11, marginBottom:10, maxWidth:"82%", borderRadius:12, background:"var(--bg-subtle)"}}>
              <div className="muted tt" style={{marginBottom:2}}>Just now</div>
              <div style={{fontSize:13}}>What did you notice on the line?</div>
            </div>

            {/* Tile options */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10}}>
              {ISSUES.slice(0,4).map(iss => {
                const on = selectedIssue === iss.id;
                return (
                  <button key={iss.id} onClick={() => setSelectedIssue(on ? null : iss.id)}
                    style={{
                      padding:"14px 12px", borderRadius:12,
                      background: on ? "var(--accent-bg)" : "#fff",
                      border: on ? "2px solid var(--accent)" : "1px solid var(--line)",
                      textAlign:"left", cursor:"pointer",
                      display:"flex", gap:10, alignItems:"center"
                    }}>
                    <div style={{width:28, height:28, borderRadius:8,
                      background: on ? iss.color : "var(--bg-subtle)", color: on ? "#fff" : iss.color,
                      display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700}}>{iss.icon}</div>
                    <div style={{fontSize:12, fontWeight:600, lineHeight:1.2}}>{iss.label}</div>
                  </button>
                );
              })}
            </div>

            {photos.length > 0 && (
              <div style={{marginBottom:10}}>
                <PhotoStrip small />
              </div>
            )}

            <div style={{flex:1}}/>

            <div className="card" style={{padding:8, display:"flex", gap:6, alignItems:"center", borderRadius:24}}>
              <button onClick={addPhoto}
                style={{width:36, height:36, borderRadius:"50%", background:"var(--bg-subtle)", color:"var(--ink-secondary)",
                  display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--line)", fontSize:18}}>
                📷
              </button>
              <span className="muted" style={{fontSize:12, flex:1}}>Type or hold mic…</span>
              <button
                onMouseDown={() => setRecording(true)}
                onMouseUp={() => setRecording(false)}
                style={{width:36, height:36, borderRadius:"50%",
                  background: recording ? "var(--cta)" : "var(--accent)",
                  color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", border:"none"}}>
                <I.mic size={16}/>
              </button>
            </div>
          </div>
        )}

        {/* Submitted toast */}
        {submitted && (
          <div style={{position:"absolute", bottom:30, left:20, right:20,
            background:"#ffffff", border:"1.5px solid var(--accent)", borderRadius:14, padding:14,
            boxShadow:"0 10px 30px rgba(16,50,207,0.20)"}}>
            <div style={{fontSize:13, fontWeight:600, color:"var(--ink-primary)"}}>Thanks — we're looking into it.</div>
            <div className="muted" style={{fontSize:12, marginTop:4}}>3 similar reports this shift. Tap to see what we're checking.</div>
          </div>
        )}
      </div>

      {showAnno && (
        <>
          <Anno tag="F1 · No jargon" style={{left:30, top:80}}>
            Zero instances of "AI", "LLM", "incident", "hypothesis", "8D", "agent", "initiative" on this screen. Only "what we noticed / we're checking".
          </Anno>
          <Anno tag="F2 · Issue tiles" style={{right:30, top:180, maxWidth:240}}>
            Square rounded tiles with colored glyphs. One tap picks a category; selected tile gets blue ring + filled glyph. Multi-select disabled — keep it one-thumb.
          </Anno>
          <Anno tag="F3 · Photo capture" style={{right:30, top:360, maxWidth:240}}>
            Dashed blue "+" tile opens camera / file picker. Captured photos stack as thumbnails; tap × to remove. Voice note sits alongside — a report can be tile-only, photo-only, voice-only, or any combination.
          </Anno>
          <Anno tag="F4 · Re-entry" style={{right:30, bottom:80, maxWidth:240}}>
            After submission the toast shows "N similar reports" — the one moment the foreman sees the signal is being correlated with others.
          </Anno>
        </>
      )}
    </div>
  );
}
window.FloorScreen = FloorScreen;
