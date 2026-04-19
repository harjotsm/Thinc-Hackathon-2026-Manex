// Incident Canvas — the hero screen. 3 variations.
const { useState: uS1, useEffect: uE1 } = React;

// Maps each signal → its primary hypothesis. Drives signal-click → graph-focus.
const SIGNAL_TO_HYP = {
  "SIG-412": "HYP-material",   // warranty thermal failure → supplier batch
  "SIG-411": "HYP-material",
  "SIG-408": "HYP-material",   // ESR out of spec
  "SIG-399": "HYP-process",    // EOL near-miss → process drift
  "SIG-387": "HYP-process",    // Cpk erosion at Stn-04
  "SIG-361": "HYP-material",   // premature field failure
  "SIG-358": "HYP-operator",   // voice of floor on shift
  "SIG-340": "HYP-design",     // social signal → broader
};

function SignalCard({ sig, onClick, focused }) {
  const linkedHyp = SIGNAL_TO_HYP[sig.id];
  const icon = I[sig.srcIcon] || I.chart;
  return (
    <div className="card" onClick={onClick}
      title={linkedHyp ? "Click → focus matching hypothesis" : undefined}
      style={{padding:10, cursor:"pointer",
        borderColor: focused ? "var(--accent-ring)" : "var(--line)",
        boxShadow: focused ? "0 0 0 2px var(--accent-ring), 0 4px 16px rgba(99,159,196,0.18)" : "none",
        background: focused ? "var(--accent-bg)" : "var(--bg-surface)",
        transition:"all 180ms",
        minWidth:0, position:"relative"}}>
      {focused && linkedHyp && (
        <div style={{position:"absolute", top:6, right:6, fontSize:9, fontWeight:600,
          color:"var(--accent)", textTransform:"uppercase", letterSpacing:"0.05em"}}>→ graph</div>
      )}
      <div className="row" style={{justifyContent:"space-between", gap:8}}>
        <div className="row" style={{gap:6, color:"var(--ink-secondary)", fontSize:11, minWidth:0, flex:1, overflow:"hidden"}}>
          <span style={{color:"var(--ink-muted)", flexShrink:0}}>{icon({size:12})}</span>
          <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sig.src}</span>
          <span className="muted" style={{flexShrink:0}}>·</span>
          <span className="muted" style={{flexShrink:0, whiteSpace:"nowrap"}}>{sig.time}</span>
        </div>
        <span className={"sev-ring " + sig.sev} style={{flexShrink:0}}/>
      </div>
      <div style={{fontSize:12, margin:"6px 0 4px", lineHeight:1.4, overflowWrap:"anywhere"}}>{sig.text}</div>
      <div className="mono muted" style={{fontSize:10, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{sig.ref}</div>
      <div className="row" style={{justifyContent:"space-between", marginTop:6}}>
        <span className="mono muted" style={{fontSize:10}}>{sig.id}</span>
      </div>
    </div>
  );
}

// Near-miss surfacing: marginal signals the correlator scored weakly but related.
// Tapping individual rows promotes them into the active signal set + auto-focuses
// the matching hypothesis in the graph.
function NearMissCard() {
  const [added, setAdded] = uS1(new Set());
  const items = DATA.incident.nearMiss || [];
  const remaining = items.filter(i => !added.has(i.id));

  if (remaining.length === 0) {
    return (
      <div className="card" style={{padding:10, border:"1px solid var(--line)", background:"var(--bg-subtle)"}}>
        <div style={{fontSize:11, fontWeight:500, color:"var(--ink-secondary)"}}>
          ✓ All near-miss signals reviewed
        </div>
      </div>
    );
  }

  return (
    <div className="card ai-marked" style={{padding:10, border:"1px dashed var(--accent-ring)", background:"var(--accent-bg)"}}>
      <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
        <div style={{fontSize:11, fontWeight:600, color:"var(--ink-primary)"}}>
          <span className="ai-spark">✦</span>+ {remaining.length} near-miss results
        </div>
        <button className="btn ghost sm" onClick={() => setAdded(new Set(items.map(i => i.id)))}
          style={{padding:"2px 6px", fontSize:10}}>Add all</button>
      </div>
      <div className="muted tt" style={{marginBottom:8}}>
        Correlator scored these MARGINAL but possibly related.
      </div>
      <div style={{display:"flex", flexDirection:"column", gap:4}}>
        {remaining.map(item => (
          <button key={item.id} onClick={() => setAdded(s => new Set([...s, item.id]))}
            style={{
              display:"flex", alignItems:"flex-start", gap:6, padding:"6px 8px",
              background:"#fff", border:"1px solid var(--line)", borderRadius:6,
              cursor:"pointer", textAlign:"left"
            }}>
            <span style={{color:"var(--accent)", fontSize:13, lineHeight:1, marginTop:1}}>+</span>
            <div style={{flex:1, minWidth:0}}>
              <div className="mono tt" style={{color:"var(--ink-muted)"}}>{item.id} · {item.src}</div>
              <div style={{fontSize:11, fontWeight:500, color:"var(--ink-primary)", lineHeight:1.3, marginTop:2,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{item.text}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function HypothesisNode({ h, active, onClick, x, y, w = 210 }) {
  const confirmed = h.confirmed;
  const speculation = h.speculation;
  return (
    <div onClick={onClick}
      style={{position:"absolute", left:x, top:y, width:w,
        background:"var(--bg-elevated)",
        border: active ? "1.5px solid var(--accent)" : speculation ? "1.5px dashed var(--line-strong)" : "1.5px solid var(--line-hi)",
        borderRadius:10, padding:"9px 11px",
        boxShadow: active ? "0 0 0 4px rgba(99,159,196,0.18), 0 0 30px rgba(99,159,196,0.20)" : "none",
        cursor:"pointer", transition:"all 200ms", overflow:"hidden"}}>
      <div className="eyebrow" style={{color: active ? "var(--accent)" : "var(--ink-muted)"}}>{h.label}</div>
      <div style={{fontSize:12.5, fontWeight:500, margin:"3px 0 7px", lineHeight:1.3,
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
        overflowWrap:"anywhere"}}>{h.title}</div>
      <div className="row" style={{gap:8}}>
        <div style={{flex:1, height:5, background:"var(--bg-inset)", borderRadius:3, overflow:"hidden"}}>
          <div style={{width:h.conf+"%", height:"100%", background: active ? "var(--accent)" : "var(--ink-muted)"}} />
        </div>
        <span className="mono tt" style={{color: active ? "var(--accent)" : "var(--ink-secondary)", fontWeight:600}}>{h.conf}%</span>
      </div>
      <div className="row muted tt" style={{marginTop:5, justifyContent:"space-between", whiteSpace:"nowrap", overflow:"hidden"}}>
        <span style={{overflow:"hidden", textOverflow:"ellipsis"}}>✓{h.evidence} · ✗{h.contradict}</span>
        {h.primary && <span style={{color:"var(--accent)", flexShrink:0, marginLeft:6}}>primary</span>}
      </div>
    </div>
  );
}

// Graph variant A — radial root-cause tree around incident node
function GraphRadial({ active, setActive }) {
  const H = DATA.incident.hypotheses;
  // Render as a 3-column CSS grid (left hypotheses | incident center | right hypotheses)
  // so the layout is always responsive and nothing overflows.
  const leftH  = H.slice(0, 2);
  const rightH = H.slice(2);

  return (
    <div style={{position:"relative", width:"100%", height:"100%", minHeight:380,
      display:"grid", gridTemplateColumns:"minmax(0,1fr) 130px minmax(0,1fr)",
      gridTemplateRows:"auto auto",
      gap:"14px 18px", alignContent:"center", justifyContent:"center",
      padding:"20px 8px"}}>

      {/* Subtle radial connector lines */}
      <svg style={{position:"absolute", inset:0, width:"100%", height:"100%",
        pointerEvents:"none", zIndex:0}} preserveAspectRatio="none" viewBox="0 0 100 100">
        <line x1="38" y1="30" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25"/>
        <line x1="38" y1="70" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25"/>
        <line x1="62" y1="30" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25"/>
        <line x1="62" y1="70" x2="50" y2="50" stroke="rgba(99,159,196,0.35)" strokeWidth="0.25"/>
      </svg>

      {/* Left-col hypotheses */}
      {leftH.map((h, i) => (
        <div key={h.id} style={{gridColumn:1, gridRow:i+1, justifySelf:"end", width:"100%", maxWidth:220, position:"relative", zIndex:1}}>
          <InlineHypNode h={h} active={h.id === active} onClick={() => setActive(h.id)}/>
        </div>
      ))}

      {/* Incident center — spans both rows */}
      <div style={{gridColumn:2, gridRow:"1 / span 2", justifySelf:"center", alignSelf:"center",
        width:120, height:86, position:"relative", zIndex:1}}>
        <div className="ring-accent" style={{width:"100%", height:"100%",
          background:"var(--bg-elevated)", border:"1.5px solid var(--accent)", borderRadius:10,
          padding:8, display:"flex", flexDirection:"column", justifyContent:"center", alignItems:"center", textAlign:"center"}}>
          <div className="eyebrow" style={{color:"var(--accent)", fontSize:9}}>INCIDENT</div>
          <div style={{fontSize:12, fontWeight:600, lineHeight:1.3, marginTop:3}}>{DATA.incident.id}</div>
          <div className="muted tt mono" style={{marginTop:2}}>17 signals</div>
        </div>
      </div>

      {/* Right-col hypotheses */}
      {rightH.map((h, i) => (
        <div key={h.id} style={{gridColumn:3, gridRow:i+1, justifySelf:"start", width:"100%", maxWidth:220, position:"relative", zIndex:1}}>
          <InlineHypNode h={h} active={h.id === active} onClick={() => setActive(h.id)}/>
        </div>
      ))}

      {/* Evidence chip under incident center, full width of center column */}
      <div style={{position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)",
        fontSize:10, maxWidth:"90%", textAlign:"center",
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}} className="muted mono">
        → 5 evidence: SIG-408, SIG-399, SIG-387, SIG-411, SIG-412
      </div>
    </div>
  );
}

// Inline, non-positioned hypothesis card used inside GraphRadial's CSS grid
function InlineHypNode({ h, active, onClick }) {
  return (
    <div onClick={onClick}
      style={{background:"var(--bg-elevated)",
        border: active ? "1.5px solid var(--accent)" : h.speculation ? "1.5px dashed var(--line-strong)" : "1.5px solid var(--line-hi)",
        borderRadius:10, padding:"9px 11px",
        boxShadow: active ? "0 0 0 4px rgba(99,159,196,0.18), 0 0 30px rgba(99,159,196,0.20)" : "none",
        cursor:"pointer", transition:"all 200ms", overflow:"hidden"}}>
      <div className="eyebrow" style={{color: active ? "var(--accent)" : "var(--ink-muted)"}}>{h.label}</div>
      <div style={{fontSize:12.5, fontWeight:500, margin:"3px 0 7px", lineHeight:1.3,
        display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
        overflowWrap:"anywhere"}}>{h.title}</div>
      <div className="row" style={{gap:8}}>
        <div style={{flex:1, height:5, background:"var(--bg-inset)", borderRadius:3, overflow:"hidden"}}>
          <div style={{width:h.conf+"%", height:"100%", background: active ? "var(--accent)" : "var(--ink-muted)"}} />
        </div>
        <span className="mono tt" style={{color: active ? "var(--accent)" : "var(--ink-secondary)", fontWeight:600}}>{h.conf}%</span>
      </div>
      <div className="row muted tt" style={{marginTop:5, justifyContent:"space-between", whiteSpace:"nowrap", overflow:"hidden"}}>
        <span style={{overflow:"hidden", textOverflow:"ellipsis"}}>✓{h.evidence} · ✗{h.contradict}</span>
        {h.primary && <span style={{color:"var(--accent)", flexShrink:0, marginLeft:6}}>primary</span>}
      </div>
    </div>
  );
}

// Graph variant B — left-to-right tree
function GraphTree({ active, setActive }) {
  const H = DATA.incident.hypotheses;
  return (
    <div style={{position:"relative", width:"100%", minHeight:520,
      display:"grid", gridTemplateColumns:"180px 80px minmax(0,1fr)",
      gridTemplateRows:`repeat(${H.length}, minmax(90px, 1fr))`,
      alignItems:"center", gap:"14px 0", padding:"20px 8px"}}>

      <svg style={{gridColumn:2, gridRow:`1 / span ${H.length}`, width:"100%", height:"100%",
        alignSelf:"stretch", pointerEvents:"none"}}
        preserveAspectRatio="none" viewBox="0 0 80 100">
        {H.map((_, i) => {
          const y = ((i + 0.5) / H.length) * 100;
          return (
            <path key={i}
              d={`M 0 50 C 40 50, 40 ${y}, 80 ${y}`}
              fill="none" stroke="rgba(99,159,196,0.5)" strokeWidth="1"
              vectorEffect="non-scaling-stroke" />
          );
        })}
      </svg>

      <div style={{gridColumn:1, gridRow:`1 / span ${H.length}`,
        justifySelf:"end", alignSelf:"center",
        width:170, position:"relative", zIndex:1}}>
        <div className="ring-accent" style={{width:"100%",
          background:"var(--bg-elevated)", border:"1.5px solid var(--accent)", borderRadius:10,
          padding:12, display:"flex", flexDirection:"column", textAlign:"left"}}>
          <div className="eyebrow" style={{color:"var(--accent)"}}>INCIDENT · ROOT</div>
          <div style={{fontSize:13, fontWeight:600, lineHeight:1.3, marginTop:4}}>
            {DATA.incident.title.split("—")[0].trim()}
          </div>
          <div className="muted tt mono" style={{marginTop:4}}>{DATA.incident.id}</div>
          <div className="muted tt" style={{marginTop:2}}>17 signals · {H.length} hypotheses</div>
        </div>
      </div>

      {H.map((h, i) => (
        <div key={h.id} style={{gridColumn:3, gridRow:i+1, minWidth:0, position:"relative", zIndex:1, paddingLeft:4}}>
          <InlineHypNode h={h} active={h.id === active} onClick={() => setActive(h.id)} />
        </div>
      ))}
    </div>
  );
}

// Graph variant C — stacked list-tree (data-dense)
function GraphStack({ active, setActive }) {
  const H = DATA.incident.hypotheses;
  return (
    <div style={{padding:14, display:"flex", flexDirection:"column", gap:10}}>
      <div className="card ring-accent" style={{padding:12}}>
        <div className="row" style={{justifyContent:"space-between"}}>
          <div>
            <div className="eyebrow" style={{color:"var(--accent)"}}>INCIDENT · ROOT</div>
            <div style={{fontSize:14, fontWeight:600, marginTop:2}}>{DATA.incident.title}</div>
          </div>
          <span className="chip sev-high">high</span>
        </div>
        <div className="muted tt mono" style={{marginTop:6}}>
          {DATA.incident.id} · 17 signals · opened {DATA.incident.opened}
        </div>
      </div>
      {H.map(h => (
        <div key={h.id} onClick={() => setActive(h.id)}
          className="card"
          style={{padding:12, marginLeft:24, cursor:"pointer",
            border: h.id === active ? "1.5px solid var(--accent)" : h.speculation ? "1.5px dashed var(--line-strong)" : "1px solid var(--line)",
            boxShadow: h.id === active ? "0 0 0 4px rgba(99,159,196,0.12)" : "none"}}>
          <div className="row" style={{justifyContent:"space-between", marginBottom:8, gap:10, alignItems:"flex-start"}}>
            <div style={{minWidth:0, flex:1}}>
              <div className="eyebrow" style={{color: h.id === active ? "var(--accent)" : "var(--ink-muted)", marginBottom:3}}>{h.label}</div>
              <div style={{fontSize:13, fontWeight:500, lineHeight:1.3, overflowWrap:"anywhere"}}>{h.title}</div>
            </div>
            <span className="mono tt" style={{color: h.id === active ? "var(--accent)" : "var(--ink-secondary)", fontWeight:600, flexShrink:0, marginTop:2}}>{h.conf}%</span>
          </div>
          <div style={{height:5, background:"var(--bg-inset)", borderRadius:3, overflow:"hidden"}}>
            <div style={{width:h.conf+"%", height:"100%", background: h.id === active ? "var(--accent)" : "var(--ink-muted)"}} />
          </div>
          <div className="row muted tt" style={{marginTop:6, gap:12}}>
            <span>✓ {h.evidence} evidence</span>
            <span>✗ {h.contradict} contradict</span>
            {h.primary && <span style={{color:"var(--accent)"}}>· primary</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline() {
  // 8 signals spread along a 24h axis
  const sigs = DATA.incident.signals;
  // Fake positions 8-96%
  const positions = [94, 88, 82, 72, 58, 30, 28, 12];
  const colorFor = (src) => ({
    Warranty:"var(--viz-4)", "EOL-Test":"var(--viz-2)", "SPC-Drift":"var(--viz-3)",
    "Inbound-Inspection":"var(--viz-5)", Voice:"var(--accent)", Social:"var(--ink-muted)"
  }[src] || "var(--ink-muted)");

  return (
    <div style={{borderTop:"1px solid var(--line)", background:"var(--bg-subtle)", padding:"10px 16px"}}>
      <div className="row" style={{justifyContent:"space-between", marginBottom:8, gap:8, flexWrap:"wrap"}}>
        <div className="row" style={{gap:10, flexShrink:0}}>
          <span className="eyebrow">Timeline</span>
          <span className="muted tt">48h window · click to focus</span>
        </div>
        <div className="row muted" style={{gap:8, fontSize:10, flexWrap:"wrap", justifyContent:"flex-end"}}>
          {["Warranty","EOL-Test","SPC-Drift","Inbound","Voice","Social"].map(k => (
            <span key={k} className="row" style={{gap:3, color:"var(--ink-muted)", fontSize:10, whiteSpace:"nowrap"}}>
              <span style={{width:6, height:6, borderRadius:3, background:colorFor(k === "Inbound" ? "Inbound-Inspection" : k)}}/>{k}
            </span>
          ))}
        </div>
      </div>
      <div style={{position:"relative", height:60, background:"var(--bg-inset)", borderRadius:6}}>
        {/* grid lines */}
        {[0,0.25,0.5,0.75,1].map(p => (
          <div key={p} style={{position:"absolute", left:`${p*100}%`, top:0, bottom:0, width:1, background:"var(--line)"}}/>
        ))}
        {/* build date */}
        <div style={{position:"absolute", left:"22%", top:0, bottom:0, width:2, background:"var(--viz-3)", opacity:0.5}}/>
        <div style={{position:"absolute", left:"22%", top:-14, fontSize:9, color:"var(--viz-3)"}} className="mono">BUILD</div>
        {/* NOW */}
        <div style={{position:"absolute", right:0, top:0, bottom:0, width:2, background:"var(--accent)"}}/>
        <div style={{position:"absolute", right:0, top:-14, fontSize:9, color:"var(--accent)"}} className="mono">NOW · 14:42</div>

        {sigs.map((s, i) => (
          <div key={s.id}
            title={`${s.id} — ${s.text}`}
            style={{position:"absolute", left:`${positions[i] || 50}%`, top:15+((i%3)*10),
              width:10, height:10, borderRadius:5, background:colorFor(s.src),
              border:"1.5px solid var(--bg-inset)", transform:"translateX(-50%)", cursor:"pointer"}} />
        ))}
      </div>
      <div className="row" style={{justifyContent:"space-between", marginTop:4}}>
        <span className="muted tt mono">-48h</span>
        <span className="muted tt mono">-24h</span>
        <span className="muted tt mono">-12h</span>
        <span className="muted tt mono">now</span>
      </div>
    </div>
  );
}

function Contribution({ c }) {
  const Ico = I[c.icon] || I.users;
  const color = c.status === "live" ? "var(--accent)" : c.status === "contributed" ? "var(--sev-low)" : c.status === "dismissed" ? "var(--ink-muted)" : "var(--ink-muted)";
  const label = { live:"Live", contributed:"Contributed", pending:"Pending", dismissed:"Dismissed" }[c.status];
  return (
    <div className="card" style={{padding:10, marginBottom:8,
      opacity: c.status === "dismissed" ? 0.4 : 1,
      textDecoration: c.status === "dismissed" ? "line-through" : "none",
      overflow:"hidden"}}>
      <div className="row" style={{justifyContent:"space-between", gap:8, alignItems:"flex-start"}}>
        <div className="row" style={{gap:8, minWidth:0, flex:1}}>
          <span style={{color:"var(--ink-muted)", flexShrink:0}}>{Ico({size:13})}</span>
          <span style={{fontSize:12, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{c.domain}</span>
        </div>
        <div className="row" style={{gap:6, flexShrink:0}}>
          <span style={{width:6, height:6, borderRadius:3, background:color,
            animation: c.status === "live" ? "pulse 1.5s infinite" : "none"}}/>
          <span className="muted tt mono" style={{whiteSpace:"nowrap"}}>{label}</span>
        </div>
      </div>
      {c.text && (
        <div className="ai-marked" style={{fontSize:11, color:"var(--ink-secondary)", marginTop:8, lineHeight:1.4,
          paddingLeft: c.status === "live" || c.status === "contributed" ? 10 : 0, overflowWrap:"anywhere"}}>
          {(c.status === "live" || c.status === "contributed") && <span className="ai-spark">✦</span>}
          {c.text}
        </div>
      )}
    </div>
  );
}

function CanvasScreen() {
  const { setRoute, showAnno } = useApp();
  const [variant, setVariant] = uS1(() => localStorage.getItem("canvas.var") || "radial");
  const [active, setActive] = uS1("HYP-material");
  const [focusedSignal, setFocusedSignal] = uS1(null);
  const [leftCollapsed, setLeftCollapsed] = uS1(false);
  const [rightCollapsed, setRightCollapsed] = uS1(false);
  const inc = DATA.incident;

  React.useEffect(() => { localStorage.setItem("canvas.var", variant); }, [variant]);
  // Side panels are user-controlled — no auto-collapse when switching variants.

  // 8D provenance bridge: if a signal id was stashed (e.g. by clicking SIG-412 in the 8D
  // doc), focus it here on mount + auto-activate matching hypothesis.
  React.useEffect(() => {
    const target = localStorage.getItem("canvas.focusSignal");
    if (target) {
      setFocusedSignal(target);
      const hyp = SIGNAL_TO_HYP[target];
      if (hyp) setActive(hyp);
      localStorage.removeItem("canvas.focusSignal");
      // Scroll the matching card into the rail viewport (manual, not scrollIntoView)
      setTimeout(() => {
        const el = document.querySelector(`[data-sig-id="${target}"]`);
        if (el) {
          const scrollParent = el.closest('[data-signal-rail-scroll]');
          if (scrollParent) {
            scrollParent.scrollTop = el.offsetTop - scrollParent.offsetTop - 80;
          }
        }
      }, 100);
    }
  }, []);

  const Graph = { radial: GraphRadial, tree: GraphTree, stack: GraphStack }[variant];

  return (
    <div style={{position:"relative", height:"calc(100vh - 48px)", display:"flex", flexDirection:"column"}}>
      {/* Sub-topbar with tabs */}
      <div style={{display:"flex", alignItems:"center", gap:10, padding:"10px 18px",
        borderBottom:"1px solid var(--line)", background:"var(--bg-surface)", minWidth:0}}>
        <button className="btn ghost sm" onClick={() => setRoute("inbox")} style={{flexShrink:0}}><I.back size={11}/>Back</button>
        <span className={"sev-ring " + inc.severity} style={{flexShrink:0}} />
        <div style={{minWidth:0, flex:"0 1 320px", overflow:"hidden"}}>
          <div style={{fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{inc.title}</div>
          <div className="muted tt mono" style={{marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
            {inc.id} · opened {inc.opened} · {inc.signals.length} signals · assigned {DATA.user.initials}
          </div>
        </div>
        <span className="chip sev-high" style={{flexShrink:0}}>high</span>
        <div className="spacer" />
        {/* Tab bar */}
        <div className="lens-switch" style={{flexShrink:0}}>
          <button className="on">Canvas</button>
          <button onClick={() => setRoute("eightd")}>8D</button>
          <button>FMEA</button>
          <button>Ishikawa</button>
          <button>Timeline</button>
        </div>
        <VarTabs
          options={[{id:"radial", label:"Radial"},{id:"tree", label:"Tree"},{id:"stack", label:"Stack"}]}
          value={variant} onChange={setVariant} />
        <div style={{width:1, height:20, background:"var(--line)", flexShrink:0}} />
        <button className="btn primary sm" onClick={() => setRoute("resolve")} style={{flexShrink:0}}>Dispatch →</button>
      </div>

      {/* 3-panel body */}
      <div style={{flex:1, display:"grid",
        gridTemplateColumns:`${leftCollapsed ? 32 : 280}px 1fr ${rightCollapsed ? 32 : 300}px`,
        minHeight:0, transition:"grid-template-columns 220ms ease"}}>
        {/* LEFT: Signals + BOM */}
        <div style={{borderRight:"1px solid var(--line)", display:"flex", flexDirection:"column", minHeight:0, position:"relative"}}>
          {leftCollapsed ? (
            <button onClick={() => setLeftCollapsed(false)} title="Expand signals"
              style={{flex:1, width:"100%", background:"var(--bg-surface)", border:"none",
                cursor:"pointer", padding:"10px 0", display:"flex", flexDirection:"column",
                alignItems:"center", gap:10, color:"var(--ink-secondary)"}}>
              <span style={{fontSize:11}}>▸</span>
              <div style={{writingMode:"vertical-rl", transform:"rotate(180deg)",
                fontSize:11, fontWeight:500, letterSpacing:0.3}}>
                Signals · {inc.signals.length}
              </div>
            </button>
          ) : (<>
          <div style={{padding:"12px 14px", borderBottom:"1px solid var(--line)"}}>
            <div className="row" style={{justifyContent:"space-between"}}>
              <div className="row" style={{gap:8}}>
                <span style={{fontSize:13, fontWeight:600}}>Signals</span>
                <span className="chip">{inc.signals.length}</span>
              </div>
              <div className="row" style={{gap:4}}>
                <button className="btn ghost sm">All</button>
                <button className="btn ghost sm">Internal</button>
                <button className="btn ghost sm">External</button>
                <button className="btn ghost sm" onClick={() => setLeftCollapsed(true)} title="Collapse">◂</button>
              </div>
            </div>
          </div>
          <div data-signal-rail-scroll style={{overflow:"auto", padding:12, display:"flex", flexDirection:"column", gap:8, flex:1}}>
            {inc.signals.map(s => (
              <div key={s.id} data-sig-id={s.id}>
                <SignalCard sig={s}
                  focused={focusedSignal === s.id}
                  onClick={() => {
                    setFocusedSignal(s.id);
                    // Bridge: clicking a signal also focuses the matching hypothesis in the graph.
                    const hyp = SIGNAL_TO_HYP[s.id];
                    if (hyp) setActive(hyp);
                  }} />
              </div>
            ))}
            {/* Near-miss affordance — surfaces marginal correlator results that DIDN'T auto-link. */}
            <NearMissCard />

            {/* BOM traceability */}
            <div className="card" style={{padding:10, marginTop:8}}>
              <div className="eyebrow" style={{marginBottom:6}}>BOM Traceability</div>
              <div className="mono tt" style={{lineHeight:1.6}}>
                <div>{inc.productName}</div>
                <div style={{paddingLeft:12, color:"var(--ink-secondary)"}}>└─ PCB assembly</div>
                <div style={{paddingLeft:24, color:"var(--ink-secondary)"}}>└─ <span style={{color:"var(--accent)"}}>{inc.part}</span></div>
                <div style={{paddingLeft:36, color:"var(--ink-muted)"}}>batch <span style={{color:"var(--accent)"}}>{inc.batch}</span></div>
                <div style={{paddingLeft:48, color:"var(--ink-muted)"}}>supplier {inc.supplier}</div>
              </div>
            </div>
          </div>

          </>)}

          {showAnno && !leftCollapsed && (
            <Anno tag="A1 · Signals rail" style={{left:280, top:60}}>
              Left rail groups every signal correlated into this incident. Click → focus node in graph. Near-miss chip at bottom surfaces MARGINAL-scored data the correlator thinks is related.
            </Anno>
          )}
        </div>

        {/* CENTER: Graph + timeline */}
        <div className="hex-bg" style={{display:"flex", flexDirection:"column", minHeight:0, position:"relative"}}>
          <div style={{flex:1, overflow:"auto", padding:16}}>
            <Graph active={active} setActive={setActive} />
          </div>
          <Timeline />

          {showAnno && (
            <>
              <Anno tag="A2 · Root-cause graph" style={{left:18, top:8}}>
                Three variants via the tabs above. Radial shows confidence at a glance; Tree is spatial; Stack is dense and printable. Primary hypothesis glows lime; dashed borders = AI speculation.
              </Anno>
              <Anno tag="A3 · Graph interactions" style={{right:18, bottom:200, position:"absolute"}}>
                Click node → focus + right-rail detail. Right-click → Challenge / Promote. + button next to a node → "Ask AI to expand this branch".
              </Anno>
            </>
          )}
        </div>

        {/* RIGHT: Contributions + AI Reasoning */}
        <div style={{borderLeft:"1px solid var(--line)", display:"flex", flexDirection:"column", minHeight:0, position:"relative"}}>
          {rightCollapsed ? (
            <button onClick={() => setRightCollapsed(false)} title="Expand contributions"
              style={{flex:1, width:"100%", background:"var(--bg-surface)", border:"none",
                cursor:"pointer", padding:"10px 0", display:"flex", flexDirection:"column",
                alignItems:"center", gap:10, color:"var(--ink-secondary)"}}>
              <span style={{fontSize:11}}>◂</span>
              <div style={{writingMode:"vertical-rl", fontSize:11, fontWeight:500, letterSpacing:0.3}}>
                Contributions · 9
              </div>
            </button>
          ) : (<>
          <div style={{padding:"12px 14px", borderBottom:"1px solid var(--line)"}}>
            <div className="row" style={{justifyContent:"space-between"}}>
              <span style={{fontSize:13, fontWeight:600}}>Stakeholder contributions</span>
              <div className="row" style={{gap:6}}>
                <span className="chip">9</span>
                <button className="btn ghost sm" onClick={() => setRightCollapsed(true)} title="Collapse">▸</button>
              </div>
            </div>
          </div>
          <div style={{overflow:"auto", padding:12, flex:1}}>
            {inc.contributions.map(c => <Contribution key={c.domain} c={c} />)}

            <div className="divider" />
            <div className="eyebrow" style={{marginBottom:8}}>AI Reasoning · v3</div>
            <div className="ai-marked" style={{fontSize:12, color:"var(--ink-secondary)", lineHeight:1.5}}>
              <div style={{color:"var(--ink-primary)", marginBottom:6}}>
                <span className="ai-spark">✦</span>Problem statement
              </div>
              A cluster of 17 signals across warranty, inbound inspection, SPC, and EOL
              near-miss channels point at <span style={{color:"var(--accent)"}}>R33</span> mounting failures on power modules built
              between 2026-03-28 and 2026-04-12. The common factor is supplier batch
              <span className="mono"> SB-00007</span> from ElektroParts, whose ESR readings
              (<span className="mono">0.28Ω mean</span>) exceed the acceptance limit of
              <span className="mono"> 0.22Ω</span>. Hypotheses ranked by fit to data; <b>Material</b>
              leads at 82% confidence with 5 pieces of supporting evidence, 0 contradicting.
            </div>
            <div className="row" style={{gap:6, marginTop:10}}>
              <button className="btn ghost sm"><I.undo size={10}/>Regenerate</button>
              <button className="btn sm">Ground on more data</button>
            </div>
          </div>

          {showAnno && !rightCollapsed && (
            <Anno tag="A4 · Contributions" style={{left:-230, top:70}}>
              Nine stakeholder domains — each either pending, live (AI fetching now), contributed (human or AI landed), or dismissed. Live dots pulse.
            </Anno>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}

window.CanvasScreen = CanvasScreen;
