// Landing + Inbox screens

function LandingScreen() {
  const { setRoute, showAnno } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("landing.var") || "split");
  React.useEffect(() => { localStorage.setItem("landing.var", variant); }, [variant]);

  const Spark = ({data, color="var(--accent)", fill=false, height=22}) => {
    const max = Math.max(...data, 1);
    const pts = data.map((v,i) => `${(i/(data.length-1))*100},${100 - (v/max)*90 - 5}`);
    return (
      <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none" style={{height}}>
        {fill && (
          <polygon fill={color} opacity="0.18"
            points={`0,100 ${pts.join(" ")} 100,100`} />
        )}
        <polyline fill="none" stroke={color} strokeWidth="2"
          points={pts.join(" ")} />
      </svg>
    );
  };

  const confCls = (c) => c >= 80 ? "conf-hi" : c >= 50 ? "conf-med" : "conf-lo";

  return (
    <div style={{padding:"20px 24px"}}>
      <div className="row" style={{justifyContent:"space-between", marginBottom:16}}>
        <div>
          <div className="eyebrow">Engineer lens · {DATA.now} · {DATA.shift}</div>
          <h1 style={{margin:"6px 0 0", fontSize:22, fontWeight:600, whiteSpace:"nowrap"}}>Good afternoon, {DATA.user.name.split(". ")[1]}.</h1>
        </div>
        <VarTabs options={[{id:"split", label:"Split"},{id:"feed", label:"Feed"},{id:"compact", label:"Compact"}]}
          value={variant} onChange={setVariant} />
      </div>

      {/* HERO pulse: 1 big + 3 secondary */}
      <div className="panel" style={{display:"grid", gridTemplateColumns:"1.6fr 1fr 1fr 1fr", marginBottom:16, position:"relative"}}>
        <div className="metric" style={{borderRight:"1px solid var(--line)", padding:"22px 20px"}}>
          <span className="label">New incidents today</span>
          <span className="value accent" style={{fontSize:52, lineHeight:1}}>{DATA.counts.openIncidents}</span>
          <div className="row" style={{justifyContent:"space-between"}}>
            <span className="delta bad">↑ 3 vs yesterday</span>
            <Spark data={[1,3,2,5,7,6,4]} color="var(--cta)" fill height={28}/>
          </div>
        </div>
        {[
          {label:"Open initiatives",   value:DATA.counts.activeInitiatives, delta:"avg age 3.4d", cls:"neu", data:[2,2,3,4,5,5,6]},
          {label:"€ cost at risk",     value:DATA.counts.costAtRisk, delta:"↑ 12% vs 7d", cls:"bad", data:[2,3,3,5,4,6,7]},
          {label:"Lessons applied",    value:DATA.counts.lessonsApplied, delta:"↑ 2 this week", cls:"good", data:[1,2,2,3,4,4,5]},
        ].map((m,i) => (
          <div key={i} className="metric" style={{borderRight: i<2 ? "1px solid var(--line)" : "none"}}>
            <span className="label">{m.label}</span>
            <span className="value">{m.value}</span>
            <div className="row" style={{justifyContent:"space-between"}}>
              <span className={"delta " + m.cls}>{m.delta}</span>
              <Spark data={m.data} color="var(--ink-muted)" height={20}/>
            </div>
          </div>
        ))}
        {showAnno && (
          <Anno tag="L1 · Hero pulse" style={{right:8, top:-48, maxWidth:260}}>
            Open Incidents hero'd at 1.5× — it's the most actionable. Deltas color-mapped to "is this good or bad for THIS metric".
          </Anno>
        )}
      </div>

      {variant !== "feed" ? (
        <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
          <div className="panel" style={{padding:16, position:"relative"}}>
            <div className="row" style={{justifyContent:"space-between", marginBottom:12}}>
              <div>
                <div className="eyebrow">Needs your attention</div>
                <div style={{fontSize:16, fontWeight:600, marginTop:2}}>Ranked by severity × cost × confidence</div>
              </div>
              <button className="btn ghost sm">Show all 14</button>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:6}}>
              {DATA.topIncidents.map(inc => (
                <div key={inc.id} onClick={() => setRoute(inc.primary ? "canvas" : "inbox")}
                  className="card" style={{padding:"10px 12px", cursor:"pointer",
                    border: inc.primary ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: inc.primary ? "var(--accent-bg)" : "var(--bg-surface)"}}>
                  <div className="row" style={{gap:12}}>
                    <span className={"sev-dot " + inc.sev} />
                    <div style={{flex:1, minWidth:0}}>
                      <div className="row" style={{gap:10}}>
                        <span className="mono" style={{fontSize:12, fontWeight:700, color:"var(--ink-primary)", whiteSpace:"nowrap"}}>{inc.id}</span>
                        <span style={{fontSize:13, fontWeight:500}}>{inc.title}</span>
                      </div>
                      <div className="row muted tt" style={{gap:10, marginTop:3}}>
                        <span>{inc.product}</span>
                        <span>·</span>
                        <span>{inc.signals} signals</span>
                        <span>·</span>
                        <span>opened {inc.age} ago</span>
                        <span>·</span>
                        <span>assigned {inc.assignee}</span>
                      </div>
                    </div>
                    <div className="col" style={{alignItems:"flex-end", gap:2}}>
                      <span className={"mono tt " + confCls(inc.conf)} style={{fontSize:13}}>
                        <span className="ai-tag" style={{marginRight:4}}/>{inc.conf}%
                      </span>
                      <span className="muted tt">AI confidence</span>
                    </div>
                    <button className="btn sm">Open</button>
                  </div>
                </div>
              ))}
            </div>
            {showAnno && (
              <Anno tag="L2 · Severity + ID" style={{right:24, top:96, maxWidth:240}}>
                Solid 8px severity dots in unified palette. INC-ID promoted to bold primary type, no longer buried in mono microtype.
              </Anno>
            )}
            {showAnno && (
              <Anno tag="L3 · Confidence by threshold" style={{right:-10, top:200, maxWidth:220}}>
                82% reads as blue (≥80), 64% as amber (50–79), 49% as muted (&lt;50). Reader scans down the column and the degradation is visible at a glance.
              </Anno>
            )}
          </div>

          <div className="panel" style={{padding:16, position:"relative"}}>
            <div className="eyebrow">Rising patterns</div>
            <div style={{fontSize:14, fontWeight:600, margin:"2px 0 10px"}}>Correlator spotted in last 24h</div>
            {[
              {title:"Dull-solder language cluster", synopsis:"Voice-of-floor + Trustpilot reviews converging on PM-00008.", trend:[1,1,2,2,3,4,5,6]},
              {title:"Shift 2 near-miss clustering", synopsis:"EOL near-misses +40% on Stn-04 over 3 days.", trend:[2,3,2,4,5,4,6,5]},
              {title:"ElektroParts ESR creep",       synopsis:"Inbound ESR mean shifting across 4 batches.", trend:[3,4,4,5,5,6,6,7]},
            ].map((p,i) => (
              <div key={i} className="card ai-block" style={{padding:"10px 12px", marginBottom:8}}>
                <div className="row" style={{justifyContent:"space-between", marginBottom:2}}>
                  <span className="ai-tag">Pattern</span>
                  <span className="muted tt">24h</span>
                </div>
                <div style={{fontSize:13, fontWeight:600, marginBottom:3}}>{p.title}</div>
                <div style={{fontSize:11, color:"var(--ink-secondary)", marginBottom:8, lineHeight:1.4}}>
                  {p.synopsis}
                </div>
                <div style={{width:"100%", marginBottom:4}}>
                  <Spark data={p.trend} color="var(--cta)" fill height={32}/>
                </div>
                <div className="row" style={{justifyContent:"flex-end"}}>
                  <button className="btn ghost sm">Investigate →</button>
                </div>
              </div>
            ))}
            {showAnno && (
              <Anno tag="L4 · AI provenance" style={{left:-230, top:40, maxWidth:220}}>
                2px blue left-bar + ✦ "Pattern" tag on every AI-authored block. Sparkline now 32px tall with filled area — the downward (or rising) slope IS the product.
              </Anno>
            )}
          </div>
        </div>
      ) : (
        <div className="panel" style={{padding:16}}>
          <div className="eyebrow">Unified feed · incidents + patterns</div>
          <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:10}}>
            {DATA.topIncidents.map(inc => (
              <div key={inc.id} className="card" style={{padding:10}}>
                <div className="row" style={{gap:12}}>
                  <span className={"sev-dot " + inc.sev}/>
                  <div style={{flex:1}}>
                    <div className="row" style={{gap:10}}>
                      <span className="mono" style={{fontSize:12, fontWeight:700, whiteSpace:"nowrap"}}>{inc.id}</span>
                      <span style={{fontSize:13, fontWeight:500}}>{inc.title}</span>
                    </div>
                    <div className="muted tt" style={{marginTop:2}}>
                      {inc.product} · {inc.signals} signals · {inc.age}
                    </div>
                  </div>
                  <button className="btn sm" onClick={() => setRoute(inc.primary ? "canvas" : "inbox")}>Open</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently resolved — with outcome chips and applied-across stat */}
      <div className="panel" style={{padding:16, marginTop:16, position:"relative"}}>
        <div className="row" style={{justifyContent:"space-between", marginBottom:10}}>
          <div>
            <div className="eyebrow">Recently resolved · Network effect</div>
            <div style={{fontSize:14, fontWeight:600, marginTop:2}}>Lessons applied across {DATA.plants.length} plants</div>
          </div>
          <button className="btn ghost sm" onClick={() => setRoute("lessons")}>Go to library →</button>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10}}>
          {DATA.lessons.slice(0,4).map(L => {
            const recurring = L.outcome === "recurring";
            return (
              <div key={L.id} className="card" style={{padding:12,
                borderTop: recurring ? "2px solid var(--amber)" : "1px solid var(--line)"}}>
                <div className="row" style={{justifyContent:"space-between"}}>
                  <span className="eyebrow mono">{L.id}</span>
                  {recurring ? (
                    <span className="chip sev-med"><span className="dot" style={{background:"var(--amber)"}}/>recurring</span>
                  ) : (
                    <span className="chip sev-low"><span className="dot" style={{background:"var(--sev-low)"}}/>resolved</span>
                  )}
                </div>
                <div style={{fontSize:12, fontWeight:600, margin:"8px 0 4px", lineHeight:1.35}}>{L.sig}</div>
                <div className="muted tt" style={{marginBottom:8, lineHeight:1.4}}>{L.fix}</div>
                <div style={{fontSize:11, color:"var(--cta)", fontWeight:700}}>
                  Applied {L.applied}× across {L.plants} plants
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.LandingScreen = LandingScreen;

// ============ INBOX ============
function InboxScreen() {
  const { setRoute, showAnno } = useApp();
  const [variant, setVariant] = React.useState(() => localStorage.getItem("inbox.var") || "table");
  const [selected, setSelected] = React.useState([]);
  const [filter, setFilter] = React.useState("all");
  const [hover, setHover] = React.useState(null);
  const [leftOpen, setLeftOpen] = React.useState(() => localStorage.getItem("inbox.left") !== "0");
  const [rightOpen, setRightOpen] = React.useState(() => localStorage.getItem("inbox.right") !== "0");
  React.useEffect(() => { localStorage.setItem("inbox.var", variant); }, [variant]);
  React.useEffect(() => { localStorage.setItem("inbox.left", leftOpen ? "1" : "0"); }, [leftOpen]);
  React.useEffect(() => { localStorage.setItem("inbox.right", rightOpen ? "1" : "0"); }, [rightOpen]);

  const rows = DATA.inbox;
  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const confCls = (c) => c >= 80 ? "conf-hi" : c >= 50 ? "conf-med" : "conf-lo";
  const hoverRow = hover ? rows.find(r => r.id === hover) : rows.find(r => r.primary);

  // Source → abbrev
  const SRC_ABBR = { mail:"CRM", truck:"INB", chart:"EOL", mic:"Voice", wave:"IoT", trend:"SPC", factory:"Rework" };

  const gridCols = [
    leftOpen ? "220px" : "40px",
    "1fr",
    rightOpen ? "320px" : "40px"
  ].join(" ");

  return (
    <div style={{display:"grid", gridTemplateColumns:gridCols, height:"calc(100vh - 52px)", transition:"grid-template-columns 200ms ease"}}>
      {/* Left filter rail — collapsible */}
      {leftOpen ? (
        <aside className="side-rail" style={{borderRight:"1px solid var(--line)", padding:"14px 12px", overflow:"auto", background:"#fff", position:"relative"}}>
          <div className="row" style={{justifyContent:"space-between", marginBottom:8}}>
            <div className="eyebrow">Saved filters</div>
            <button className="rail-toggle" onClick={() => setLeftOpen(false)} title="Collapse filter rail">‹</button>
          </div>
          {[
            {id:"all", label:"All", n:14},
            {id:"mine", label:"Mine", n:5},
            {id:"unassigned", label:"Unassigned", n:2},
            {id:"critical", label:"Critical", n:0},
            {id:"field", label:"From field", n:12},
            {id:"floor", label:"From floor", n:3},
            {id:"supplier", label:"From supplier", n:4},
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{display:"flex", width:"100%", justifyContent:"space-between",
                padding:"6px 8px", borderRadius:6, marginBottom:2, fontSize:12,
                background: filter === f.id ? "var(--accent-bg)" : "transparent",
                color: filter === f.id ? "var(--cta)" : "var(--ink-secondary)",
                fontWeight: filter === f.id ? 600 : 500}}>
              <span>{f.label}</span>
              <span className="muted tt">{f.n}</span>
            </button>
          ))}
          <div className="divider" style={{margin:"14px 0"}} />
          <div className="eyebrow" style={{marginBottom:8}}>Sources</div>
          {["CRM","MES","Warranty","Voice","Social","Inbound","SPC","EOL"].map(s => (
            <label key={s} style={{display:"flex", gap:8, alignItems:"center", padding:"4px 8px", fontSize:12, color:"var(--ink-secondary)"}}>
              <input type="checkbox" defaultChecked />{s}
            </label>
          ))}
        </aside>
      ) : (
        <aside className="side-rail collapsed" style={{borderRight:"1px solid var(--line)", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0"}}>
          <button className="rail-toggle big" onClick={() => setLeftOpen(true)} title="Expand filters">›</button>
          <div style={{writingMode:"vertical-rl", transform:"rotate(180deg)", marginTop:14, fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--ink-muted)", fontWeight:600}}>
            Filters {filter !== "all" ? "· " + filter : ""}
          </div>
        </aside>
      )}

      {/* Main */}
      <div style={{display:"flex", flexDirection:"column", minHeight:0, position:"relative"}}>
        <div style={{padding:"12px 18px", borderBottom:"1px solid var(--line)", display:"flex", gap:12, alignItems:"center", background:"#fff", flexWrap:"wrap"}}>
          <div style={{fontSize:16, fontWeight:600}}>
            {DATA.counts.openIncidents} incidents
            <span className="muted" style={{fontSize:12, fontWeight:500, marginLeft:6}}>· {rows.length} visible</span>
          </div>
          {filter !== "all" && (
            <div className="row" style={{gap:6}}>
              <span className="chip" style={{background:"var(--accent-bg)", color:"var(--cta)", borderColor:"var(--accent-ring)"}}>
                filter: {filter}
                <button onClick={() => setFilter("all")} style={{marginLeft:4, color:"var(--cta)"}}>×</button>
              </span>
            </div>
          )}
          {selected.length > 0 ? (
            <div className="row" style={{gap:6, marginLeft:12}}>
              <span className="chip" style={{background:"var(--accent-bg)", color:"var(--cta)"}}>{selected.length} selected</span>
              <button className="btn sm">Assign</button>
              <button className="btn sm">Dismiss</button>
              {selected.length >= 2 && (
                <button className="btn primary sm">
                  <span style={{marginRight:4}}>⎘</span>Merge into one incident
                </button>
              )}
            </div>
          ) : (
            <span className="muted tt" style={{marginLeft:12}}>Click a row for preview · Select 2+ to merge</span>
          )}
          <div className="spacer"/>
          <VarTabs options={[{id:"table", label:"Table"},{id:"cards", label:"Cards"}]}
            value={variant} onChange={setVariant} />
          <button className="btn ghost sm" onClick={() => { setLeftOpen(false); setRightOpen(false); }}
            title="Full-width table">⤢ Maximize</button>
        </div>

        <div style={{flex:1, overflow:"auto"}}>
          {variant === "table" ? (
            <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
              <thead>
                <tr style={{color:"var(--ink-muted)", fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", background:"#fff"}}>
                  <th style={{padding:"10px 14px", textAlign:"left", width:32}}></th>
                  <th style={{padding:"10px 6px", textAlign:"left", width:24}}></th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Incident</th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Product</th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Sources</th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Signals</th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Last seen</th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Owner</th>
                  <th style={{padding:"10px 8px", textAlign:"left"}}>Status</th>
                  <th style={{padding:"10px 14px", textAlign:"left"}}>AI conf.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isHover = hover === r.id;
                  const shown = r.sources.slice(0,2);
                  const extra = r.sources.length - shown.length;
                  return (
                    <tr key={r.id}
                      onMouseEnter={() => setHover(r.id)}
                      style={{borderTop:"1px solid var(--line)",
                        background: r.primary ? "var(--accent-bg)" : (isHover ? "var(--bg-subtle)" : "transparent"),
                        cursor:"pointer"}}
                      onClick={() => r.primary ? setRoute("canvas") : null}>
                      <td style={{padding:"12px 14px"}}>
                        <input type="checkbox" checked={selected.includes(r.id)}
                          onChange={(e) => { e.stopPropagation(); toggle(r.id); }}
                          onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td style={{padding:"12px 6px"}}><span className={"sev-dot " + r.sev}/></td>
                      <td style={{padding:"12px 8px"}}>
                        <div className="row" style={{gap:8}}>
                          <span className="mono" style={{fontSize:11, fontWeight:700, color:"var(--ink-primary)", whiteSpace:"nowrap"}}>{r.id}</span>
                          <span style={{fontWeight:500}}>{r.title}</span>
                        </div>
                      </td>
                      <td style={{padding:"12px 8px"}} className="mono muted">{r.product}</td>
                      <td style={{padding:"12px 8px"}}>
                        <div className="row" style={{gap:4, flexWrap:"wrap"}}>
                          {shown.map((s,i) => (
                            <span key={i} className="chip" style={{padding:"1px 6px", fontSize:10, background:"var(--bg-inset)"}}>
                              {SRC_ABBR[s] || s}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span className="chip" style={{padding:"1px 6px", fontSize:10, color:"var(--cta)", fontWeight:700}}>+{extra}</span>
                          )}
                        </div>
                      </td>
                      <td style={{padding:"12px 8px"}} className="mono">{r.count}</td>
                      <td style={{padding:"12px 8px"}} className="muted">{r.last}</td>
                      <td style={{padding:"12px 8px"}}>{r.owner}</td>
                      <td style={{padding:"12px 8px"}}>
                        <span className={"status-chip " + r.status}>{r.status}</span>
                      </td>
                      <td style={{padding:"12px 14px"}} className={"mono " + confCls(r.conf)}>
                        <span className="ai-tag" style={{marginRight:3}}/>{r.conf}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{padding:18, display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:10}}>
              {rows.map(r => (
                <div key={r.id} className="card" style={{padding:12, cursor:"pointer",
                  border: r.primary ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: r.primary ? "var(--accent-bg)" : "#fff"}}
                  onClick={() => r.primary && setRoute("canvas")}>
                  <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
                    <div className="row" style={{gap:8}}>
                      <span className={"sev-dot " + r.sev}/>
                      <span className="mono" style={{fontSize:11, fontWeight:700}}>{r.id}</span>
                    </div>
                    <span className={"mono tt " + confCls(r.conf)}>
                      <span className="ai-tag" style={{marginRight:3}}/>{r.conf}%
                    </span>
                  </div>
                  <div style={{fontSize:13, fontWeight:500, marginBottom:6}}>{r.title}</div>
                  <div className="row" style={{justifyContent:"space-between"}}>
                    <span className="muted tt">{r.product} · {r.count} signals · {r.last}</span>
                    <span className={"status-chip " + r.status}>{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showAnno && leftOpen && rightOpen && (
          <>
            <Anno tag="IB1 · Collapsible rails" style={{left:240, top:56, maxWidth:240}}>
              Both rails collapse. Click chevrons, or "⤢ Maximize" for full-width table. State persists in localStorage.
            </Anno>
            <Anno tag="IB2 · Source pills" style={{left:240, top:160, maxWidth:220}}>
              Max 2 visible + "+N". Readable labels (CRM, EOL, IoT) instead of overlapping glyphs.
            </Anno>
          </>
        )}
      </div>

      {/* Right preview rail — collapsible */}
      {rightOpen ? (
        <aside className="side-rail" style={{borderLeft:"1px solid var(--line)", padding:"14px 16px", overflow:"auto", background:"#fff", position:"relative"}}>
          <div className="row" style={{justifyContent:"space-between", marginBottom:6}}>
            <div className="eyebrow">Preview</div>
            <button className="rail-toggle" onClick={() => setRightOpen(false)} title="Collapse preview">›</button>
          </div>
          {hoverRow ? (
            <>
              <div className="row" style={{gap:8, marginBottom:4}}>
                <span className={"sev-dot " + hoverRow.sev}/>
                <span className="mono" style={{fontSize:12, fontWeight:700, whiteSpace:"nowrap"}}>{hoverRow.id}</span>
              </div>
              <div style={{fontSize:14, fontWeight:600, lineHeight:1.35, marginBottom:10}}>{hoverRow.title}</div>

              <div className="ai-block" style={{marginBottom:14}}>
                <div className="ai-tag" style={{marginBottom:4}}>AI summary</div>
                <div style={{fontSize:12, lineHeight:1.5, color:"var(--ink-secondary)"}}>
                  Convergent signals from CRM warranty, inbound inspection, and EOL near-miss clustering.
                  Most likely cause: supplier batch ESR out of spec. Confidence {hoverRow.conf}%.
                </div>
              </div>

              <div className="eyebrow" style={{marginBottom:6}}>Top 3 signals</div>
              {(DATA.incident.signals || []).slice(0,3).map(s => (
                <div key={s.id} className="card" style={{padding:10, marginBottom:6, background:"var(--bg-subtle)"}}>
                  <div className="row" style={{justifyContent:"space-between", marginBottom:3, gap:6}}>
                    <span className="mono tt muted" style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", minWidth:0}}>{s.id} · {s.src}</span>
                    <span className={"sev-dot " + s.sev} style={{flexShrink:0}}/>
                  </div>
                  <div style={{fontSize:11, lineHeight:1.4}}>{s.text}</div>
                </div>
              ))}

              <button className="btn primary" style={{width:"100%", marginTop:10, justifyContent:"center"}}
                onClick={() => hoverRow.primary && setRoute("canvas")}>
                Open canvas →
              </button>
            </>
          ) : (
            <div className="muted tt" style={{textAlign:"center", marginTop:40}}>
              Hover a row to preview
            </div>
          )}
        </aside>
      ) : (
        <aside className="side-rail collapsed" style={{borderLeft:"1px solid var(--line)", background:"#fff", display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0"}}>
          <button className="rail-toggle big" onClick={() => setRightOpen(true)} title="Expand preview">‹</button>
          <div style={{writingMode:"vertical-rl", marginTop:14, fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase", color:"var(--ink-muted)", fontWeight:600}}>
            Preview
          </div>
        </aside>
      )}
    </div>
  );
}

window.InboxScreen = InboxScreen;
