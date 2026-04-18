// Resolve + 8D + Initiatives + Lessons + Connectors + Leadership + Floor

// ================= RESOLVE =================
function ResolveScreen() {
  const { setRoute, showAnno } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("resolve.var") || "stack");
  React.useEffect(() => { localStorage.setItem("resolve.var", variant); }, [variant]);
  const [included, setIncluded] = React.useState(Object.fromEntries(DATA.agents.map(a => [a.id, true])));
  const [dispatched, setDispatched] = React.useState(false);

  const onCount = Object.values(included).filter(Boolean).length;

  return (
    <div style={{display:"flex", flexDirection:"column", height:"calc(100vh - 48px)"}}>
      <div style={{display:"flex", alignItems:"center", gap:12, padding:"10px 18px",
        borderBottom:"1px solid var(--line)", background:"var(--bg-surface)"}}>
        <button className="btn ghost sm" onClick={() => setRoute("canvas")}><I.back size={11}/>Canvas</button>
        <span className={"sev-ring high"} />
        <div>
          <div style={{fontSize:14, fontWeight:600}}>Resolve · {DATA.incident.id}</div>
          <div className="muted tt mono" style={{marginTop:1}}>{DATA.incident.title}</div>
        </div>
        <div className="spacer" />
        <VarTabs options={[{id:"stack", label:"Stack"},{id:"grid", label:"Grid"},{id:"flow", label:"Flow"}]}
          value={variant} onChange={setVariant} />
      </div>

      <div style={{flex:1, display:"grid", gridTemplateColumns:"1fr 440px", minHeight:0, overflow:"hidden"}}>
        {/* Agent panels */}
        <div style={{overflow:"auto", padding:18, position:"relative"}}>
          <div className="eyebrow" style={{marginBottom:6}}>Act III · Resolve</div>
          <div style={{fontSize:18, fontWeight:600, marginBottom:14}}>5 domain agents, 5 initiatives</div>

          <div style={{display:"flex", flexDirection: variant === "grid" ? "row" : "column",
            flexWrap:"wrap", gap:12}}>
            {DATA.agents.map((a, idx) => {
              const Ico = I[a.icon] || I.factory;
              const on = included[a.id];
              return (
                <div key={a.id} className="card ai-marked"
                  style={{padding:14, position:"relative",
                    width: variant === "grid" ? "calc(50% - 6px)" : "100%",
                    borderColor: on ? "var(--line-hi)" : "var(--line)",
                    opacity: on ? 1 : 0.55}}>
                  <div className="row" style={{justifyContent:"space-between", marginBottom:10}}>
                    <div className="row" style={{gap:10}}>
                      <div style={{width:28, height:28, borderRadius:6, background:"var(--bg-elevated)",
                        display:"flex", alignItems:"center", justifyContent:"center", color:"var(--accent)"}}>
                        <Ico size={14}/>
                      </div>
                      <div>
                        <div style={{fontSize:13, fontWeight:600}}>
                          <span className="ai-spark">✦</span>{a.name}
                        </div>
                        <div className="muted tt mono">→ posts to {a.target}</div>
                      </div>
                    </div>
                    <label className="row" style={{gap:6, fontSize:11}}>
                      <input type="checkbox" checked={on}
                        onChange={e => setIncluded({...included, [a.id]: e.target.checked})} />
                      <span className="muted">Include in dispatch</span>
                    </label>
                  </div>

                  <div style={{background:"var(--bg-inset)", border:"1px solid var(--line)",
                    borderRadius:6, padding:10, fontSize:12, lineHeight:1.5,
                    borderLeft:"2px solid var(--accent)"}}>
                    {a.draft}
                  </div>

                  <div className="row" style={{gap:10, marginTop:10, flexWrap:"wrap"}}>
                    <div className="row" style={{gap:6}}>
                      <span className="muted tt">Owner</span>
                      <span className="chip">{a.owner}</span>
                    </div>
                    <div className="row" style={{gap:6}}>
                      <span className="muted tt">Due</span>
                      <span className="chip">{a.due}</span>
                    </div>
                    <div className="row" style={{gap:6}}>
                      <span className="muted tt">Priority</span>
                      <span className="chip">{a.priority}</span>
                    </div>
                    <div className="spacer"/>
                    <span className="chip" style={{color:"var(--accent)", borderColor:"var(--accent-ring)", background:"var(--accent-bg)"}}>
                      {a.impact}
                    </span>
                  </div>

                  <details style={{marginTop:10}}>
                    <summary className="muted tt mono" style={{cursor:"pointer"}}>Tool payload preview</summary>
                    <pre className="mono" style={{fontSize:10, color:"var(--ink-muted)",
                      background:"var(--bg-inset)", padding:8, borderRadius:6, marginTop:6, overflow:"auto"}}>
{`POST ${a.target} / ${a.name.split(" ")[0].toLowerCase()}_action
{
  "incident_id": "${DATA.incident.id}",
  "owner": "${a.owner}",
  "due": "${a.due}",
  "priority": "${a.priority.toLowerCase()}"
}`}
                    </pre>
                  </details>

                  {showAnno && idx === 0 && (
                    <Anno tag="R1 · Agent card" style={{right:-240, top:0}}>
                      Five stacked agents. Each drafts a real payload into its system of record. Lime left-bar marks AI-authored draft.
                    </Anno>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Impact Simulator */}
        <div style={{borderLeft:"1px solid var(--line)", padding:18, overflow:"auto", position:"relative"}}>
          <div className="eyebrow">Impact Simulator</div>
          <div style={{fontSize:16, fontWeight:600, margin:"4px 0 16px"}}>Projected outcome</div>

          <div className="panel" style={{padding:16, marginBottom:12}}>
            <div className="label muted" style={{fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase"}}>Claims avoided</div>
            <div style={{fontSize:44, fontWeight:600, color:"var(--accent)", letterSpacing:"-0.02em", lineHeight:1}}>11</div>
            <div className="muted tt" style={{marginTop:4}}>over 12 weeks · ±2 at 80% confidence</div>
          </div>

          <div className="panel" style={{padding:16, marginBottom:12}}>
            <div className="eyebrow" style={{marginBottom:4}}>€ cost avoided (range)</div>
            <div style={{fontSize:26, fontWeight:600}}>€48k – €92k</div>
            <div style={{display:"flex", gap:2, marginTop:10, height:36, alignItems:"flex-end"}}>
              <div style={{flex:1, background:"var(--bg-inset)", borderRadius:4, height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end"}}>
                <div style={{height:"85%", background:"var(--sev-crit)"}}/>
              </div>
              <div style={{flex:1, background:"var(--bg-inset)", borderRadius:4, height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end"}}>
                <div style={{height:"30%", background:"var(--accent)"}}/>
              </div>
            </div>
            <div className="row muted tt" style={{justifyContent:"space-between", marginTop:4}}>
              <span>Without action</span>
              <span>With dispatch</span>
            </div>
          </div>

          <div className="eyebrow" style={{margin:"14px 0 8px"}}>Similar past incidents</div>
          {DATA.lessons.slice(0,3).map(L => (
            <div key={L.id} className="card" style={{padding:10, marginBottom:8}}>
              <div className="row" style={{justifyContent:"space-between"}}>
                <span className="mono muted tt">{L.id}</span>
                <span className="chip sev-low">resolved</span>
              </div>
              <div style={{fontSize:12, fontWeight:500, margin:"4px 0"}}>{L.sig}</div>
              <div className="muted tt">Applied {L.applied}× · {L.plants} plants</div>
            </div>
          ))}

          {showAnno && (
            <Anno tag="R2 · Network effect" style={{left:-250, top:300}}>
              3 nearest lessons retrieved by embedding similarity. The more plants use Resolve, the better this gets.
            </Anno>
          )}
        </div>
      </div>

      {/* Sticky bottom dispatch */}
      <div style={{padding:14, borderTop:"1px solid var(--line)", background:"var(--bg-surface)",
        display:"flex", alignItems:"center", gap:14}}>
        <div className="muted tt">
          {onCount} of 5 agents included · all have owner + due date
        </div>
        <div className="spacer"/>
        <button className="btn ghost sm">Save draft</button>
        <button className="btn primary"
          onClick={() => { setDispatched(true); setTimeout(() => setRoute("initiatives"), 1200); }}
          style={{padding:"8px 18px"}}>
          Dispatch {onCount} initiatives →
        </button>
      </div>
      {dispatched && (
        <div className="sweep" style={{position:"absolute", inset:0, pointerEvents:"none"}}/>
      )}
    </div>
  );
}
window.ResolveScreen = ResolveScreen;

// ================= 8D =================
function EightDScreen() {
  const { setRoute, showAnno } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("eightd.var") || "doc");
  React.useEffect(() => { localStorage.setItem("eightd.var", variant); }, [variant]);

  const sections = [
    { d:"D1", title:"Team", content:"M. Bauer (PQ Lead), J. Keller (Supplier Q), S. Müller (R&D), T. Roth (Logistics), L. Ahmed (CX).", src:["CTR-01","CTR-08"] },
    { d:"D2", title:"Problem description", content:"Power Module PM-00008 field failures clustered on units built with supplier batch SB-00007 (ElektroParts). Symptom: intermittent shutdown under load, with thermal signature. 17 signals correlated across warranty, inbound inspection, SPC, and EOL near-miss data.", ai:true, src:["SIG-412","SIG-411","SIG-408","SIG-399","SIG-387"] },
    { d:"D3", title:"Interim containment", content:"Quarantine affected serials at Werk München Linie 1. Insert 100% ESR inspection at Stn-04 until batch SB-00007 exhaustion.", ai:true, src:["INI-091","SIG-408"] },
    { d:"D4", title:"Root cause", content:"ElektroParts batch SB-00007 R33 parts show ESR mean 0.28Ω vs spec ≤0.22Ω. Elevated ESR under sustained load produces thermal rise exceeding R33 footprint margin, resulting in premature cold-solder separation.", ai:true, src:["SIG-408","CTR-01","CTR-04"] },
    { d:"D5", title:"Chosen corrective action", content:"Supplier 8D to ElektroParts for batch traceability + process review. R&D spec revision to require ESR tolerance check at acceptance. Production quarantine + inspection step. Proactive customer outreach on 340 at-risk serials.", ai:true, src:["INI-091","INI-092","INI-093","INI-094"] },
    { d:"D6", title:"Implement & verify", content:"Initiatives INI-091…095 dispatched to MES, SRM, Jira, ERP, CRM. Verification: 72h SPC + 4-week warranty accrual review.", src:["INI-091","INI-095"] },
    { d:"D7", title:"Prevent recurrence", content:"FMEA update on R33 material grade; inbound ESR screen now baseline for supplier ElektroParts; lesson LES-018 applied.", ai:true, src:["LES-018","CTR-04"] },
    { d:"D8", title:"Close-out", content:"Team recognized in quarterly QRB. Lesson filed to network library.", src:[] },
  ];

  return (
    <div style={{height:"calc(100vh - 48px)", display:"flex", flexDirection:"column"}}>
      <div style={{display:"flex", alignItems:"center", gap:12, padding:"10px 18px",
        borderBottom:"1px solid var(--line)", background:"var(--bg-surface)"}}>
        <button className="btn ghost sm" onClick={() => setRoute("canvas")}><I.back size={11}/>Canvas</button>
        <div>
          <div style={{fontSize:14, fontWeight:600}}>8D Report — {DATA.incident.id}</div>
          <div className="muted tt mono">v3 · auto-drafted 2 min ago · every section sourced</div>
        </div>
        <div className="spacer"/>
        <button className="btn ghost sm"><I.undo size={11}/>Re-draft from canvas</button>
        <button className="btn ghost sm">Revision history ▾</button>
        <button className="btn sm">Export PDF</button>
        <VarTabs options={[{id:"doc", label:"Document"},{id:"split", label:"Split"}]}
          value={variant} onChange={setVariant}/>
      </div>

      <div style={{flex:1, overflow:"auto", padding:"24px 0"}}>
        <div style={{maxWidth: variant === "doc" ? 800 : 1200, margin:"0 auto",
          display: variant === "split" ? "grid" : "block",
          gridTemplateColumns: variant === "split" ? "1fr 300px" : undefined,
          gap:20, padding:"0 24px"}}>
          <div>
            {/* Header block */}
            <div className="panel" style={{padding:20, marginBottom:16}}>
              <div className="eyebrow">Report · 8D</div>
              <div style={{fontSize:22, fontWeight:600, margin:"6px 0"}}>{DATA.incident.title}</div>
              <div className="muted tt mono">
                {DATA.incident.id} · PM-00008 · {DATA.incident.supplier} · batch {DATA.incident.batch} · opened 2026-04-18 14:25
              </div>
            </div>

            {sections.map(s => (
              <div key={s.d} className={s.ai ? "card ai-marked" : "card"} style={{padding:16, marginBottom:10}}>
                <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
                  <div className="row" style={{gap:10}}>
                    <span className="mono" style={{fontSize:11, fontWeight:600, color:"var(--accent)", letterSpacing:"0.08em"}}>{s.d}</span>
                    <span style={{fontSize:14, fontWeight:600}}>{s.title}</span>
                    {s.ai && <span className="chip" style={{background:"var(--accent-bg)", color:"var(--accent)", borderColor:"var(--accent-ring)"}}>
                      <span className="ai-spark">✦</span>AI-drafted
                    </span>}
                  </div>
                  <button className="btn ghost sm"><I.pencil size={10}/>Override</button>
                </div>
                <div style={{fontSize:13, color:"var(--ink-secondary)", lineHeight:1.55}}>
                  {s.content}
                </div>
                {s.src.length > 0 && (
                  <div className="muted mono" style={{fontSize:10, marginTop:10, letterSpacing:"0.04em"}}>
                    Sourced from: {s.src.map((x,i) => (
                      <span key={x}>
                        <a href="#" style={{color:"var(--accent)", textDecoration:"none"}}>{x}</a>
                        {i < s.src.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {showAnno && (
              <Anno tag="8D1 · Provenance" style={{position:"fixed", left:18, top:180}}>
                Every claim carries a "Sourced from: SIG/CTR/INI/LES" line. Click any id → jumps back to canvas with that node focused. This is the "report writes itself, but every claim is traceable" story.
              </Anno>
            )}
          </div>

          {variant === "split" && (
            <aside style={{position:"sticky", top:0, alignSelf:"flex-start"}}>
              <div className="panel" style={{padding:14}}>
                <div className="eyebrow" style={{marginBottom:10}}>Provenance map</div>
                <div style={{fontSize:11, color:"var(--ink-secondary)", lineHeight:1.6}}>
                  <div style={{marginBottom:10}}>
                    <div className="muted">SIGNALS</div>
                    <div className="mono">SIG-412 · SIG-411 · SIG-408<br/>SIG-399 · SIG-387 · SIG-361</div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div className="muted">CONTRIBUTIONS</div>
                    <div className="mono">CTR-01 · CTR-04 · CTR-08</div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div className="muted">INITIATIVES</div>
                    <div className="mono">INI-091 · INI-092 · INI-093<br/>INI-094 · INI-095</div>
                  </div>
                  <div>
                    <div className="muted">LESSONS APPLIED</div>
                    <div className="mono">LES-018</div>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
window.EightDScreen = EightDScreen;
