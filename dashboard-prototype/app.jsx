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
      <div className="nav-brand">
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
      <Item id="inbox"       icon={<I.inbox />}    label="Inbox"       badge={DATA.counts.openIncidents} badgeHot />
      <Item id="incidents"   icon={<I.incident />} label="Incidents"   badge="127" />
      <Item id="initiatives" icon={<I.flow />}     label="Initiatives" badge={DATA.counts.activeInitiatives} />
      <Item id="lessons"     icon={<I.book />}     label="Lessons" />

      {!collapsed && <div className="nav-group">Views</div>}
      {collapsed && <div className="nav-sep"/>}
      <Item id="leadership" icon={<I.chart />} label="Leadership" />
      <Item id="floor"      icon={<I.mobile />} label="Floor" />

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
      <div className="cmdk">
        <I.search size={12} />
        <span>Search incidents, lessons, signals…</span>
        <span className="kbd">⌘K</span>
      </div>
      <div className="lens-switch">
        <button className={lens === "engineer" ? "on" : ""} onClick={() => setLens("engineer")}>
          <span className="licon"><I.factory size={13}/></span>Engineer
        </button>
        <button className={lens === "floor" ? "on" : ""} onClick={() => setLens("floor")}>
          <span className="licon"><I.mobile size={13}/></span>Floor
        </button>
        <button className={lens === "leadership" ? "on" : ""} onClick={() => setLens("leadership")}>
          <span className="licon"><I.chart size={13}/></span>Leadership
        </button>
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
          <option value="engineer">Engineer</option>
          <option value="floor">Floor</option>
          <option value="leadership">Leadership</option>
        </select>
      </label>
      <label style={{display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12}}>
        <span>Annotations</span>
        <input type="checkbox" checked={state.showAnno} onChange={e => setState({...state, showAnno:e.target.checked})} />
      </label>
    </div>
  );
}

// ===== App root =====
function App() {
  const [route, setRoute] = useState(() => localStorage.getItem("resolve.route") || "landing");
  const [lens, setLens] = useState(() => localStorage.getItem("resolve.lens") || "engineer");
  const [showAnno, setShowAnno] = useState(() => (localStorage.getItem("resolve.anno") || "1") === "1");
  const [navCollapsed, setNavCollapsed] = useState(() => localStorage.getItem("resolve.nav") === "1");
  const [navUserToggled, setNavUserToggled] = useState(false);

  // Auto-collapse nav when entering a focused in-incident route
  const focusedRoutes = ["canvas", "resolve", "eightd"];
  useEffect(() => {
    if (navUserToggled) return;
    if (focusedRoutes.includes(route)) setNavCollapsed(true);
    else setNavCollapsed(false);
  }, [route]);

  const handleSetNavCollapsed = (v) => { setNavUserToggled(true); setNavCollapsed(v); };

  useEffect(() => { localStorage.setItem("resolve.route", route); }, [route]);
  useEffect(() => { localStorage.setItem("resolve.lens", lens); }, [lens]);
  useEffect(() => { localStorage.setItem("resolve.anno", showAnno ? "1" : "0"); }, [showAnno]);
  useEffect(() => { localStorage.setItem("resolve.nav", navCollapsed ? "1" : "0"); }, [navCollapsed]);

  // Lens routing: floor → /floor screen. Leadership → /leadership.
  useEffect(() => {
    if (lens === "floor") setRoute("floor");
    if (lens === "leadership" && route !== "leadership") setRoute("leadership");
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
    leadership: { crumbs: ["Leadership"], El: LeadershipScreen },
    connectors: { crumbs: ["Settings", "Connectors"], El: ConnectorsScreen },
    settings: { crumbs: ["Settings"], El: ConnectorsScreen },
  };
  const s = screens[route] || screens.landing;
  const El = s.El;

  return (
    <AppCtx.Provider value={ctx}>
      <div className={"app " + (navCollapsed ? "nav-collapsed " : "") + (showAnno ? "" : "no-anno")}>
        <LeftNav route={route} setRoute={setRoute} collapsed={navCollapsed} setCollapsed={handleSetNavCollapsed} />
        <main className="main">
          <Topbar crumbs={s.crumbs} lens={lens} setLens={setLens} showAnno={showAnno} setShowAnno={setShowAnno} />
          <div className="page">
            <El />
          </div>
        </main>
      </div>
      <Tweaks state={{lens, showAnno}} setState={(s) => { setLens(s.lens); setShowAnno(s.showAnno); }} />
    </AppCtx.Provider>
  );
}

window.App = App;
