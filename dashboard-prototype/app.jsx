// App shell: nav, topbar, lens switcher, annotations toggle, Tweaks, routing.
const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;

const AppCtx = createContext(null);
window.AppCtx = AppCtx;
const useApp = () => useContext(AppCtx);
window.useApp = useApp;

function LeftNav({ route, setRoute, collapsed, setCollapsed }) {
  const Item = ({id, icon, label, badge, badgeHot}) => (
    <a className={"nav-item " + (route === id ? "active" : "")}
       onClick={(e) => { e.preventDefault(); setRoute(id); }}
       href={"#" + id}
       title={collapsed ? label : undefined}>
      <span className="nav-icon">{icon}</span>
      {!collapsed && <span className="nav-label">{label}</span>}
      {!collapsed && badge != null && <span className={"nav-badge" + (badgeHot ? " hot" : "")}>{badge}</span>}
      {collapsed && badge != null && badgeHot && <span className="nav-dot"/>}
    </a>
  );
  return (
    <aside className={"nav " + (collapsed ? "collapsed" : "")}>
      <div className="nav-brand" onClick={() => setRoute("landing")} style={{cursor:"pointer"}} title="Home">
        <img src="assets/manex-mark.png" className="brand-mark" alt="Manex"/>
        {!collapsed && (
          <>
            <div>
              <div className="brand-name">Resolve</div>
              <div style={{fontSize:9, color:"var(--ink-muted)", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600, marginTop:1}}>by Manex</div>
            </div>
            <div className="brand-sub">v0.1</div>
          </>
        )}
      </div>
      <button className="nav-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? "›" : "‹"}
      </button>

      {!collapsed && <div className="nav-group">Workspace</div>}
      {collapsed && <div className="nav-sep"/>}
      <Item id="landing"     icon={<I.home />}     label="Home" />
      <Item id="inbox"       icon={<I.inbox />}    label="Inbox"       badge={DATA.counts.openIncidents} badgeHot />
      <Item id="incidents"   icon={<I.incident />} label="Incidents"   badge="127" />
      <Item id="initiatives" icon={<I.flow />}     label="Initiatives" badge={DATA.counts.activeInitiatives} />
      <Item id="lessons"     icon={<I.book />}     label="Lessons" />

      {!collapsed && <div className="nav-group">Views</div>}
      {collapsed && <div className="nav-sep"/>}
      {DATA.user.canAccessLeadership && (
        <Item id="leadership" icon={<I.chart />} label="Leadership" />
      )}
      {DATA.user.canAccessFloor && (
        <Item id="floor"      icon={<I.mobile />} label="Floor" />
      )}

      {!collapsed && <div className="nav-group">Setup</div>}
      {collapsed && <div className="nav-sep"/>}
      <Item id="connectors" icon={<I.plug />}     label="Connectors" badge="12" />
      <Item id="settings"   icon={<I.settings />} label="Settings" />

      <div className="nav-foot">
        <div className="user-chip">
          <div className="avatar">{DATA.user.initials}</div>
          {!collapsed && (
            <div style={{lineHeight:1.25}}>
              <div>{DATA.user.name}</div>
              <div className="muted tt">{DATA.user.role} · {DATA.user.plant}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, lens, setLens, showAnno, setShowAnno, right }) {
  return (
    <div className="topbar">
      <div className="bc">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{margin:"0 6px"}}>/</span>}
            {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="spacer" />
      <div className="cmdk" onClick={() => window.dispatchEvent(new CustomEvent("open-palette"))} style={{cursor:"pointer"}}>
        <I.search size={12} />
        <span>Search incidents, lessons, signals…</span>
        <span className="kbd">⌘K</span>
      </div>
      <div className="lens-switch">
        {DATA.user.canAccessEngineer && (
          <button className={lens === "engineer" ? "on" : ""} onClick={() => setLens("engineer")}>
            <span className="licon"><I.factory size={13}/></span><span className="llabel">Engineer</span>
          </button>
        )}
        {DATA.user.canAccessFloor && (
          <button className={lens === "floor" ? "on" : ""} onClick={() => setLens("floor")}>
            <span className="licon"><I.mobile size={13}/></span><span className="llabel">Floor</span>
          </button>
        )}
        {DATA.user.canAccessLeadership && (
          <button className={lens === "leadership" ? "on" : ""} onClick={() => setLens("leadership")}>
            <span className="licon"><I.chart size={13}/></span><span className="llabel">Leadership</span>
          </button>
        )}
      </div>
      <button className="btn ghost sm" title="Toggle annotations"
              onClick={() => setShowAnno(v => !v)}>
        {showAnno ? "Hide notes" : "Show notes"}
      </button>
      {right}
    </div>
  );
}

// Annotation primitive
function Anno({ tag, children, style }) {
  return <div className="anno" data-tag={tag} style={style}>{children}</div>;
}
window.Anno = Anno;

// Variation tabs
function VarTabs({ options, value, onChange }) {
  return (
    <div className="var-tabs">
      {options.map(o => (
        <button key={o.id} className={value === o.id ? "on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
window.VarTabs = VarTabs;

// Tweaks panel
function Tweaks({ state, setState }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e) => {
      if (e.data?.type === "__activate_edit_mode") setOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setOpen(false);
    };
    window.addEventListener("message", h);
    window.parent.postMessage({type:"__edit_mode_available"}, "*");
    return () => window.removeEventListener("message", h);
  }, []);
  if (!open) return null;
  return (
    <div style={{position:"fixed", right:18, bottom:18, width:280, zIndex:100,
      background:"var(--bg-elevated)", border:"1px solid var(--line-hi)", borderRadius:12, padding:14,
      boxShadow:"0 12px 40px rgba(0,0,0,0.5)"}}>
      <div style={{fontSize:11, letterSpacing:"0.12em", textTransform:"uppercase", color:"var(--ink-muted)", marginBottom:10}}>Tweaks</div>
      <label style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, fontSize:12}}>
        <span>Lens</span>
        <select value={state.lens} onChange={(e) => setState({...state, lens:e.target.value})}
          style={{background:"var(--bg-subtle)", color:"var(--ink-primary)", border:"1px solid var(--line)", borderRadius:6, padding:"3px 6px"}}>
          {DATA.user.canAccessEngineer && <option value="engineer">Engineer</option>}
          {DATA.user.canAccessFloor && <option value="floor">Floor</option>}
          {DATA.user.canAccessLeadership && <option value="leadership">Leadership</option>}
        </select>
      </label>
      <label style={{display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12}}>
        <span>Annotations</span>
        <input type="checkbox" checked={state.showAnno} onChange={e => setState({...state, showAnno:e.target.checked})} />
      </label>
    </div>
  );
}

// ===== Lens-switch toast =====
function LensToast({ label }) {
  if (!label) return null;
  return (
    <div style={{
      position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
      background:"var(--ink-primary)", color:"#fff", padding:"10px 18px",
      borderRadius:6, fontSize:13, fontWeight:500, zIndex:1000,
      boxShadow:"0 12px 32px rgba(22,0,66,0.24)",
      animation:"toastIn 220ms ease-out", display:"flex", alignItems:"center", gap:10
    }}>
      <span style={{display:"inline-block", width:6, height:6, borderRadius:"50%", background:"var(--accent)"}}/>
      Switched to <strong style={{fontWeight:600}}>{label}</strong>
      <span className="mono" style={{opacity:0.5, fontSize:10, marginLeft:6}}>⌘K to navigate</span>
    </div>
  );
}

// ===== Command palette (⌘K) =====
function CommandPalette({ open, onClose, setRoute, setLens }) {
  const [q, setQ] = React.useState("");
  const [idx, setIdx] = React.useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setQ(""); setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const cmds = [
    { id:"go-landing", label:"Go to Home", hint:"Landing", icon:"🏠", run: () => setRoute("landing") },
    { id:"go-inbox", label:"Open Inbox", hint:"All incidents", icon:"📥", run: () => setRoute("inbox") },
    { id:"go-canvas", label:"Open Canvas (SB-00007)", hint:"Reasoning view", icon:"🧭", run: () => setRoute("canvas") },
    { id:"go-resolve", label:"Open Resolve (5 agents)", hint:"Dispatch view", icon:"⚡", run: () => setRoute("resolve") },
    { id:"go-8d", label:"Open 8D Report", hint:"Auto-projection", icon:"📋", run: () => setRoute("eightd") },
    { id:"go-init", label:"Open Initiatives", hint:"Kanban", icon:"🗂", run: () => setRoute("initiatives") },
    { id:"go-less", label:"Open Lessons library", hint:"Past resolutions", icon:"📚", run: () => setRoute("lessons") },
    { id:"go-leader", label:"Open Leadership view", hint:"Pareto · plants · cost", icon:"📊", run: () => { setLens("leadership"); setRoute("leadership"); } },
    { id:"lens-eng", label:"Switch to Engineer lens", hint:"Default", icon:"🔬", run: () => setLens("engineer") },
    { id:"lens-floor", label:"Switch to Floor lens", hint:"Operator phone view", icon:"📱", run: () => setLens("floor") },
    { id:"lens-lead", label:"Switch to Leadership lens", hint:"Plant director view", icon:"📈", run: () => setLens("leadership") },
    { id:"go-conn", label:"Open Connectors", hint:"Integrations", icon:"🔌", run: () => setRoute("connectors") },
  ];
  const filtered = q
    ? cmds.filter(c => (c.label + " " + c.hint).toLowerCase().includes(q.toLowerCase()))
    : cmds;

  React.useEffect(() => { if (idx >= filtered.length) setIdx(0); }, [filtered.length]);

  if (!open) return null;
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i+1, filtered.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i-1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const c = filtered[idx];
      if (c) { c.run(); onClose(); }
    }
  };
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(22,0,66,0.4)", backdropFilter:"blur(4px)",
      zIndex:2000, display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:120
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:"min(560px, 92vw)", background:"#fff", borderRadius:10,
        boxShadow:"0 24px 64px rgba(22,0,66,0.28)", overflow:"hidden",
        border:"1px solid var(--line)"
      }}>
        <div style={{display:"flex", alignItems:"center", padding:"14px 18px", borderBottom:"1px solid var(--line)", gap:10}}>
          <span style={{fontSize:14, color:"var(--ink-muted)"}}>⌘</span>
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={onKey} placeholder="Jump to anything…"
            style={{flex:1, border:"none", outline:"none", fontSize:15, color:"var(--ink-primary)",
              fontFamily:"inherit", background:"transparent"}}/>
          <span className="mono" style={{fontSize:10, color:"var(--ink-muted)", padding:"2px 6px",
            border:"1px solid var(--line)", borderRadius:3}}>esc</span>
        </div>
        <div style={{maxHeight:360, overflow:"auto", padding:6}}>
          {filtered.length === 0 && (
            <div style={{padding:"24px 18px", textAlign:"center", color:"var(--ink-muted)", fontSize:13}}>
              No commands match "{q}"
            </div>
          )}
          {filtered.map((c, i) => (
            <div key={c.id}
              onClick={() => { c.run(); onClose(); }}
              onMouseEnter={() => setIdx(i)}
              style={{display:"flex", alignItems:"center", gap:12, padding:"10px 12px",
                borderRadius:6, cursor:"pointer",
                background: i === idx ? "var(--accent-bg)" : "transparent"}}>
              <span style={{fontSize:16, width:22, textAlign:"center"}}>{c.icon}</span>
              <span style={{fontSize:13, fontWeight:500, color:"var(--ink-primary)", flex:1}}>{c.label}</span>
              <span style={{fontSize:11, color:"var(--ink-muted)"}}>{c.hint}</span>
              {i === idx && <span className="mono" style={{fontSize:10, color:"var(--cta)", fontWeight:600}}>↵</span>}
            </div>
          ))}
        </div>
        <div style={{padding:"8px 14px", borderTop:"1px solid var(--line)", background:"var(--bg-subtle)",
          fontSize:10, color:"var(--ink-muted)", display:"flex", justifyContent:"space-between"}}>
          <span>↑ ↓ navigate · ↵ select</span>
          <span>{filtered.length} commands</span>
        </div>
      </div>
    </div>
  );
}

// ===== App root =====
function App() {
  const [route, setRoute] = useState(() => localStorage.getItem("resolve.route") || "landing");
  const [lens, setLensRaw] = useState(() => localStorage.getItem("resolve.lens") || "engineer");
  const [showAnno, setShowAnno] = useState(() => (localStorage.getItem("resolve.anno") || "1") === "1");
  const [lensToast, setLensToast] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const setLens = React.useCallback((next) => {
    setLensRaw(prev => {
      if (prev !== next) {
        const labels = { engineer:"Engineer lens", floor:"Floor lens", leadership:"Leadership lens" };
        setLensToast(labels[next] || next);
        setTimeout(() => setLensToast(null), 1800);
      }
      return next;
    });
  }, []);

  // ⌘K palette
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    const onOpen = () => setPaletteOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-palette", onOpen);
    };
  }, []);
  // Sidebar state persists across routes — user-controlled only, never auto-toggled.
  // "open" | "collapsed"  (icon rail when collapsed; fully hidden mode removed)
  const [navMode, setNavMode] = useState(() => {
    const saved = localStorage.getItem("resolve.nav");
    // Guard against stale "hidden" value from the previous auto-hide logic
    return saved === "collapsed" ? "collapsed" : "open";
  });
  useEffect(() => { localStorage.setItem("resolve.nav", navMode); }, [navMode]);

  useEffect(() => { localStorage.setItem("resolve.route", route); }, [route]);
  useEffect(() => { localStorage.setItem("resolve.lens", lens); }, [lens]);
  useEffect(() => { localStorage.setItem("resolve.anno", showAnno ? "1" : "0"); }, [showAnno]);

  // Lens routing: floor → /floor screen. Leadership → /leadership.
  // Each lens is gated by the user's role; unauthorized attempts revert.
  useEffect(() => {
    if (lens === "floor" && DATA.user.canAccessFloor) setRoute("floor");
    if (lens === "floor" && !DATA.user.canAccessFloor) setLens(DATA.user.canAccessEngineer ? "engineer" : "leadership");
    if (lens === "leadership" && DATA.user.canAccessLeadership && route !== "leadership") setRoute("leadership");
    if (lens === "leadership" && !DATA.user.canAccessLeadership) setLens(DATA.user.canAccessEngineer ? "engineer" : "floor");
    if (lens === "engineer" && !DATA.user.canAccessEngineer) setLens(DATA.user.canAccessFloor ? "floor" : "leadership");
    if (lens === "engineer" && route === "floor") setRoute("landing");
  }, [lens]);

  const ctx = { route, setRoute, lens, setLens, showAnno };

  // Floor lens = fullscreen mobile view, no side nav
  if (lens === "floor" || route === "floor") {
    return (
      <AppCtx.Provider value={ctx}>
        <div className={"app floor " + (showAnno ? "" : "no-anno")}>
          <FloorScreen />
        </div>
        <Tweaks state={{lens, showAnno}} setState={(s) => { setLens(s.lens); setShowAnno(s.showAnno); }} />
        <LensToast label={lensToast}/>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} setRoute={setRoute} setLens={setLens}/>
      </AppCtx.Provider>
    );
  }

  const screens = {
    landing: { crumbs: ["Home"], El: LandingScreen },
    inbox: { crumbs: ["Inbox"], El: InboxScreen },
    incidents: { crumbs: ["Incidents"], El: InboxScreen },
    canvas: { crumbs: ["Incidents", DATA.incident.id, "Canvas"], El: CanvasScreen },
    eightd: { crumbs: ["Incidents", DATA.incident.id, "8D Report"], El: EightDScreen },
    resolve: { crumbs: ["Incidents", DATA.incident.id, "Resolve"], El: ResolveScreen },
    initiatives: { crumbs: ["Initiatives"], El: InitiativesScreen },
    lessons: { crumbs: ["Lessons"], El: LessonsScreen },
    leadership: { crumbs: ["Leadership"], El: DATA.user.canAccessLeadership ? LeadershipScreen : LandingScreen },
    connectors: { crumbs: ["Settings", "Connectors"], El: ConnectorsScreen },
    settings: { crumbs: ["Settings"], El: ConnectorsScreen },
  };
  const s = screens[route] || screens.landing;
  const El = s.El;

  return (
    <AppCtx.Provider value={ctx}>
      <div className={"app " + (navMode === "collapsed" ? "nav-collapsed " : "") + (showAnno ? "" : "no-anno")}>
        <LeftNav route={route} setRoute={setRoute} collapsed={navMode === "collapsed"} setCollapsed={(v) => setNavMode(v ? "collapsed" : "open")} />
        <main className="main">
          <Topbar crumbs={s.crumbs} lens={lens} setLens={setLens} showAnno={showAnno} setShowAnno={setShowAnno} />
          <div className="page">
            <El />
          </div>
        </main>
      </div>
      <Tweaks state={{lens, showAnno}} setState={(s) => { setLens(s.lens); setShowAnno(s.showAnno); }} />
      <LensToast label={lensToast}/>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} setRoute={setRoute} setLens={setLens}/>
    </AppCtx.Provider>
  );
}

window.App = App;
