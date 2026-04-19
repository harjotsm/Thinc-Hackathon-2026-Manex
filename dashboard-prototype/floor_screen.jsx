// Floor lens — operator/foreman intake. Native-feeling phone UI.
// Fixes applied (2026-04-18):
//  - Post-submit success state now blocks the surface and offers "see what we're checking" → routes to engineer Canvas
//  - Minimal & Chat variants now have explicit Send buttons + voice transcript preview
//  - "Something else" tile opens a freeform textarea
//  - DE/EN language toggle (defaults DE — Werk München is German plant)

const FLOOR_I18N = {
  de: {
    greeting: "Hallo Markus",
    line: "Montage Linie 1 ·",
    prompt: "Was ist dir aufgefallen?",
    sub: "Tippe was passt, oder halte das Mikro.",
    addPhoto: "Foto hinzufügen (optional)",
    holdToTalk: "Mikro halten für Sprachnotiz",
    listening: "Höre zu…",
    sample: "…der dritte Kratzer in dieser Schicht…",
    typeNote: "Oder schreib eine kurze Notiz unten",
    send: "Bericht senden",
    needPick: "Wähle etwas oder halte das Mikro",
    myReports: "Meine Meldungen heute",
    statusTriaged: "Eingestuft", statusInvestigating: "Wird geprüft", statusResolved: "Gelöst",
    minimalTitle: "Was ist dir aufgefallen?",
    minimalSub: "Sag's einfach. Wir kümmern uns.",
    tapHold: "Tippen & halten zum Sprechen",
    orPhoto: "oder Foto hinzufügen",
    chatPrompt: "Was hast du auf der Linie bemerkt?",
    typeOrMic: "Tippen oder Mikro halten…",
    sending: "Sende…",
    sentTitle: "Danke, Markus.",
    sentSub: "Wir prüfen das. 3 ähnliche Meldungen diese Schicht.",
    seeChecking: "Sehen, was wir prüfen →",
    sendAnother: "Neue Meldung",
    backToReport: "Zurück",
    other: "Etwas anderes",
    otherPlaceholder: "Beschreibe kurz, was los ist…",
    issues: {
      scratch: "Kratzer / Beule",
      noise: "Komisches Geräusch",
      batch: "Charge wirkt anders",
      label: "Falsches Etikett",
      heat: "Hitze-Warnung",
      other: "Etwas anderes",
    },
  },
  en: {
    greeting: "Hi Markus",
    line: "Assembly Line 1 ·",
    prompt: "What did you notice?",
    sub: "Tap what fits, or hold the mic.",
    addPhoto: "Add a photo (optional)",
    holdToTalk: "Hold to add voice note",
    listening: "Listening…",
    sample: "…the third scratch this shift…",
    typeNote: "Or type a quick note below",
    send: "Send report",
    needPick: "Pick something or hold the mic",
    myReports: "My reports today",
    statusTriaged: "Triaged", statusInvestigating: "Investigating", statusResolved: "Resolved",
    minimalTitle: "What did you notice?",
    minimalSub: "Just tell us. We'll handle the rest.",
    tapHold: "Tap & hold to talk",
    orPhoto: "or add a photo",
    chatPrompt: "What did you notice on the line?",
    typeOrMic: "Type or hold mic…",
    sending: "Sending…",
    sentTitle: "Thanks, Markus.",
    sentSub: "We're looking into it. 3 similar reports this shift.",
    seeChecking: "See what we're checking →",
    sendAnother: "New report",
    backToReport: "Back",
    other: "Something else",
    otherPlaceholder: "Briefly describe what's going on…",
    issues: {
      scratch: "Scratch / dent",
      noise: "Strange noise",
      batch: "Batch looks off",
      label: "Wrong label",
      heat: "Heat warning",
      other: "Something else",
    },
  },
};

function FloorScreen() {
  const { setLens, setRoute, showAnno } = useApp();
  const [recording, setRecording] = React.useState(false);
  const [transcript, setTranscript] = React.useState("");          // accumulated voice/typed text
  const [otherText, setOtherText] = React.useState("");            // freeform when "Something else" picked
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [photos, setPhotos] = React.useState([]);
  const [selectedIssue, setSelectedIssue] = React.useState(null);
  const [variant, setVariant] = React.useState(() => localStorage.getItem("floor.var") || "classic");
  const [lang, setLang] = React.useState(() => localStorage.getItem("floor.lang") || "de");
  const t = FLOOR_I18N[lang];

  React.useEffect(() => { localStorage.setItem("floor.var", variant); }, [variant]);
  React.useEffect(() => { localStorage.setItem("floor.lang", lang); }, [lang]);

  // Simulated voice transcript builds while held
  React.useEffect(() => {
    if (!recording) return;
    const sample = t.sample;
    let i = transcript.length > 0 ? transcript.length : 0;
    const id = setInterval(() => {
      i += 2;
      setTranscript(sample.slice(0, i));
      if (i >= sample.length) clearInterval(id);
    }, 80);
    return () => clearInterval(id);
  }, [recording, lang]);

  const hasInput = !!selectedIssue || photos.length > 0 || transcript.trim().length > 0 || otherText.trim().length > 0;

  const submit = () => {
    if (!hasInput) return;
    setSubmitting(true);
    setRecording(false);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 700);
  };

  const reset = () => {
    setSubmitted(false);
    setPhotos([]);
    setSelectedIssue(null);
    setTranscript("");
    setOtherText("");
  };

  const goSeeChecking = () => {
    // Bridge floor → engineer view, focused on INC-00001
    setLens("engineer");
    setRoute("canvas");
  };

  const addPhoto = () => {
    setPhotos(p => [...p, { id: Date.now(), label: "Photo " + (p.length + 1) }]);
  };

  const ISSUES = [
    { id:"scratch", labelKey:"scratch", icon:"✦", color:"var(--sev-high)" },
    { id:"noise",   labelKey:"noise",   icon:"~", color:"var(--accent)" },
    { id:"batch",   labelKey:"batch",   icon:"◆", color:"var(--cta)" },
    { id:"label",   labelKey:"label",   icon:"▤", color:"var(--sev-med)" },
    { id:"heat",    labelKey:"heat",    icon:"△", color:"var(--sev-crit)" },
    { id:"other",   labelKey:"other",   icon:"?", color:"var(--ink-muted)" },
  ];

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

  // Voice/typed transcript preview chip
  const TranscriptChip = () => transcript ? (
    <div style={{
      padding:"10px 12px",
      background:"var(--bg-subtle)",
      border:"1px solid var(--line)",
      borderRadius:10,
      marginBottom:10,
      display:"flex", gap:8, alignItems:"flex-start"
    }}>
      <I.mic size={14} style={{marginTop:2, color:"var(--accent)", flexShrink:0}}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:12, fontWeight:500, color:"var(--ink-primary)", lineHeight:1.4}}>"{transcript}"</div>
      </div>
      <button onClick={() => setTranscript("")} style={{
        background:"transparent", border:"none", color:"var(--ink-muted)", fontSize:14, cursor:"pointer", padding:0, flexShrink:0
      }}>×</button>
    </div>
  ) : null;

  const FreeformPanel = () => selectedIssue === "other" ? (
    <div style={{marginBottom:16}}>
      <textarea
        value={otherText}
        onChange={(e) => setOtherText(e.target.value)}
        placeholder={t.otherPlaceholder}
        autoFocus
        style={{
          width:"100%", minHeight:80, padding:12, borderRadius:10,
          border:"1.5px solid var(--accent)", fontFamily:"inherit", fontSize:13, lineHeight:1.45,
          color:"var(--ink-primary)", resize:"vertical", outline:"none",
          background:"#fff",
          boxShadow:"0 0 0 3px rgba(99,159,196,0.12)"
        }}
      />
    </div>
  ) : null;

  return (
    <div style={{width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
      background:"#eef3f7", position:"relative"}}>

      {/* Floating controls */}
      <div style={{position:"absolute", top:16, right:16, display:"flex", gap:6, zIndex:10, alignItems:"center"}}>
        {/* Language toggle */}
        <div style={{display:"inline-flex", background:"#fff", border:"1px solid var(--line)", borderRadius:6, overflow:"hidden", boxShadow:"0 1px 2px rgba(22,0,66,0.04)"}}>
          {["de","en"].map(l => (
            <button key={l} onClick={() => setLang(l)}
              style={{
                padding:"5px 9px", fontSize:11, fontWeight:600, letterSpacing:"0.04em",
                background: lang === l ? "var(--ink-primary)" : "transparent",
                color: lang === l ? "#fff" : "var(--ink-muted)",
                border:"none", cursor:"pointer", textTransform:"uppercase"
              }}>{l}</button>
          ))}
        </div>
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

        {/* CLASSIC VARIANT */}
        {variant === "classic" && !submitted && (
          <div style={{padding:"8px 20px 20px", overflow:"auto", height:"calc(100% - 44px)"}}>
            <div className="row" style={{gap:10, marginBottom:18}}>
              <div style={{width:32, height:32, borderRadius:"50%", background:"var(--accent)", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700}}>M</div>
              <div>
                <div style={{fontSize:14, fontWeight:600}}>{t.greeting}</div>
                <div className="muted tt">{t.line} {DATA.shift}</div>
              </div>
            </div>

            <div style={{fontSize:20, fontWeight:700, letterSpacing:"-0.01em", marginBottom:4, color:"var(--ink-primary)"}}>
              {t.prompt}
            </div>
            <div className="muted" style={{fontSize:13, marginBottom:16}}>{t.sub}</div>

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
                    <div style={{fontSize:12, fontWeight:600, color:"var(--ink-primary)", lineHeight:1.2}}>{t.issues[iss.labelKey]}</div>
                  </button>
                );
              })}
            </div>

            <FreeformPanel />

            <div style={{marginBottom:16}}>
              <div className="muted" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8}}>
                {t.addPhoto}
              </div>
              <PhotoStrip />
            </div>

            <TranscriptChip />

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
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:13, fontWeight:600}}>
                  {recording ? t.listening : t.holdToTalk}
                </div>
                <div className="muted tt" style={{marginTop:2}}>
                  {recording ? "●●●" : t.typeNote}
                </div>
              </div>
            </div>

            <button onClick={submit}
              disabled={!hasInput || submitting}
              style={{
                width:"100%", padding:"14px", borderRadius:12,
                background: hasInput ? "var(--cta)" : "var(--bg-inset)",
                color: hasInput ? "#fff" : "var(--ink-muted)",
                fontWeight:600, fontSize:14, border:"none",
                cursor: hasInput ? "pointer" : "not-allowed",
                transition:"background 150ms"
              }}>
              {submitting ? t.sending : (hasInput ? t.send : t.needPick)}
            </button>

            <div style={{marginTop:22}}>
              <div className="muted" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8}}>
                {t.myReports}
              </div>
              {DATA.floorReports.map((r,i) => {
                const color = r.status === "Resolved" ? "var(--sev-low)" : r.status === "Investigating" ? "var(--accent)" : "var(--ink-muted)";
                const localized = r.status === "Resolved" ? t.statusResolved : r.status === "Investigating" ? t.statusInvestigating : t.statusTriaged;
                return (
                  <div key={i} className="card" style={{padding:10, marginBottom:6, borderRadius:10}}>
                    <div className="row" style={{justifyContent:"space-between"}}>
                      <div className="row" style={{gap:8}}>
                        <span style={{width:8, height:8, borderRadius:4, background:color}}/>
                        <span style={{fontSize:12, fontWeight:500}}>{r.text}</span>
                      </div>
                      <span className="muted tt">{r.time}</span>
                    </div>
                    <div className="muted tt" style={{marginLeft:16, marginTop:2, color}}>{localized}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MINIMAL VARIANT */}
        {variant === "minimal" && !submitted && (
          <div style={{padding:"42px 22px 22px", display:"flex", flexDirection:"column", alignItems:"center", height:"calc(100% - 44px)", overflow:"auto"}}>
            <div style={{fontSize:24, fontWeight:700, textAlign:"center", marginBottom:6, lineHeight:1.2, color:"var(--ink-primary)"}}>
              {t.minimalTitle}
            </div>
            <div className="muted" style={{textAlign:"center", marginBottom:28, fontSize:13}}>
              {t.minimalSub}
            </div>
            <button
              onMouseDown={() => setRecording(true)}
              onMouseUp={() => setRecording(false)}
              onTouchStart={() => setRecording(true)}
              onTouchEnd={() => setRecording(false)}
              style={{width:170, height:170, borderRadius:"50%",
                background: recording ? "var(--cta)" : "var(--accent)", color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                border:"none",
                boxShadow: recording ? "0 0 0 10px rgba(16,50,207,0.15)" : "0 10px 40px rgba(99,159,196,0.40)",
                animation: recording ? "none" : "pulse 2.5s infinite",
                transition:"all 200ms",
                flexShrink:0
              }}>
              <I.mic size={64}/>
            </button>
            <div className="muted" style={{marginTop:18, fontSize:12}}>
              {recording ? t.listening : t.tapHold}
            </div>

            {/* Transcript preview surfaces here once recorded */}
            {transcript && (
              <div style={{
                marginTop:18, width:"100%",
                padding:"12px 14px",
                background:"var(--bg-subtle)",
                border:"1px solid var(--line)",
                borderRadius:12,
                display:"flex", gap:10, alignItems:"flex-start"
              }}>
                <I.mic size={14} style={{marginTop:2, color:"var(--accent)", flexShrink:0}}/>
                <div style={{flex:1, fontSize:13, lineHeight:1.4, color:"var(--ink-primary)"}}>"{transcript}"</div>
                <button onClick={() => setTranscript("")} style={{
                  background:"transparent", border:"none", color:"var(--ink-muted)", fontSize:16, cursor:"pointer", padding:0
                }}>×</button>
              </div>
            )}

            {/* Photo strip if any */}
            {photos.length > 0 && (
              <div style={{marginTop:14, width:"100%"}}>
                <PhotoStrip small />
              </div>
            )}

            {/* Add-photo small action */}
            {photos.length === 0 && (
              <div style={{marginTop:18, width:"100%"}}>
                <div className="muted" style={{fontSize:10, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:600, marginBottom:8, textAlign:"center"}}>
                  {t.orPhoto}
                </div>
                <div style={{display:"flex", justifyContent:"center"}}>
                  <PhotoStrip small />
                </div>
              </div>
            )}

            {/* SEND button — sticky to bottom */}
            <div style={{marginTop:"auto", paddingTop:18, width:"100%"}}>
              <button onClick={submit} disabled={!hasInput || submitting}
                style={{
                  width:"100%", padding:"14px", borderRadius:12,
                  background: hasInput ? "var(--cta)" : "var(--bg-inset)",
                  color: hasInput ? "#fff" : "var(--ink-muted)",
                  fontWeight:600, fontSize:14, border:"none",
                  cursor: hasInput ? "pointer" : "not-allowed",
                  transition:"background 150ms"
                }}>
                {submitting ? t.sending : (hasInput ? t.send : t.needPick)}
              </button>
              <div style={{textAlign:"center", marginTop:8, fontSize:11, color:"var(--ink-muted)"}}>
                Markus · Linie 1 · {DATA.shift}
              </div>
            </div>
          </div>
        )}

        {/* CHAT VARIANT */}
        {variant === "chat" && !submitted && (
          <div style={{padding:"14px 14px 12px", display:"flex", flexDirection:"column", height:"calc(100% - 44px)"}}>
            <div style={{fontSize:15, fontWeight:700, marginBottom:10}}>Resolve</div>

            {/* Bot prompt */}
            <div className="card" style={{padding:11, marginBottom:10, maxWidth:"82%", borderRadius:12, background:"var(--bg-subtle)"}}>
              <div className="muted tt" style={{marginBottom:2}}>Resolve · {DATA.now}</div>
              <div style={{fontSize:13}}>{t.chatPrompt}</div>
            </div>

            {/* Tile suggestions */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10}}>
              {ISSUES.slice(0,4).map(iss => {
                const on = selectedIssue === iss.id;
                return (
                  <button key={iss.id} onClick={() => setSelectedIssue(on ? null : iss.id)}
                    style={{
                      padding:"12px 10px", borderRadius:12,
                      background: on ? "var(--accent-bg)" : "#fff",
                      border: on ? "2px solid var(--accent)" : "1px solid var(--line)",
                      textAlign:"left", cursor:"pointer",
                      display:"flex", gap:10, alignItems:"center"
                    }}>
                    <div style={{width:26, height:26, borderRadius:8,
                      background: on ? iss.color : "var(--bg-subtle)", color: on ? "#fff" : iss.color,
                      display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, flexShrink:0, fontSize:14}}>{iss.icon}</div>
                    <div style={{fontSize:11.5, fontWeight:600, lineHeight:1.2}}>{t.issues[iss.labelKey]}</div>
                  </button>
                );
              })}
            </div>

            {/* User chat bubbles for chosen things */}
            {selectedIssue && (
              <div style={{alignSelf:"flex-end", maxWidth:"82%", marginBottom:8,
                padding:"10px 12px", borderRadius:14, background:"var(--cta)", color:"#fff",
                fontSize:13, fontWeight:500
              }}>
                {t.issues[ISSUES.find(i => i.id === selectedIssue).labelKey]}
              </div>
            )}
            {transcript && (
              <div style={{alignSelf:"flex-end", maxWidth:"82%", marginBottom:8,
                padding:"10px 12px", borderRadius:14, background:"var(--cta)", color:"#fff",
                fontSize:13, fontWeight:500, display:"flex", gap:8, alignItems:"flex-start"
              }}>
                <I.mic size={12} style={{marginTop:3, opacity:0.85, flexShrink:0}}/>
                <span style={{flex:1}}>"{transcript}"</span>
              </div>
            )}
            {photos.length > 0 && (
              <div style={{alignSelf:"flex-end", maxWidth:"82%", marginBottom:8}}>
                <PhotoStrip small />
              </div>
            )}

            <div style={{flex:1}}/>

            {/* Composer + SEND */}
            <div className="card" style={{padding:8, display:"flex", gap:6, alignItems:"center", borderRadius:24, marginBottom:8}}>
              <button onClick={addPhoto}
                style={{width:34, height:34, borderRadius:"50%", background:"var(--bg-subtle)", color:"var(--ink-secondary)",
                  display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--line)", fontSize:16, flexShrink:0, cursor:"pointer"}}>
                📷
              </button>
              <span className="muted" style={{fontSize:12, flex:1, paddingLeft:4}}>{recording ? t.listening : t.typeOrMic}</span>
              <button
                onMouseDown={() => setRecording(true)}
                onMouseUp={() => setRecording(false)}
                onTouchStart={() => setRecording(true)}
                onTouchEnd={() => setRecording(false)}
                style={{width:34, height:34, borderRadius:"50%",
                  background: recording ? "var(--cta)" : "var(--accent)",
                  color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", border:"none", flexShrink:0,
                  boxShadow: recording ? "0 0 0 4px rgba(16,50,207,0.15)" : "none"}}>
                <I.mic size={14}/>
              </button>
            </div>
            <button onClick={submit} disabled={!hasInput || submitting}
              style={{
                width:"100%", padding:"12px", borderRadius:12,
                background: hasInput ? "var(--cta)" : "var(--bg-inset)",
                color: hasInput ? "#fff" : "var(--ink-muted)",
                fontWeight:600, fontSize:13.5, border:"none",
                cursor: hasInput ? "pointer" : "not-allowed",
                transition:"background 150ms"
              }}>
              {submitting ? t.sending : (hasInput ? t.send : t.needPick)}
            </button>
          </div>
        )}

        {/* SUBMITTED — full surface success state */}
        {submitted && (
          <div style={{
            padding:"30px 24px",
            height:"calc(100% - 44px)",
            display:"flex", flexDirection:"column",
            background:"linear-gradient(180deg, #fff 0%, #f4faff 100%)",
            position:"relative", overflow:"auto"
          }}>
            {/* Big check */}
            <div style={{
              width:80, height:80, borderRadius:"50%",
              background:"var(--cta)", color:"#fff",
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"24px auto 18px",
              boxShadow:"0 12px 32px rgba(16,50,207,0.30)",
              animation:"pulse 2.5s infinite"
            }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>

            <div style={{textAlign:"center", fontSize:20, fontWeight:700, color:"var(--ink-primary)", marginBottom:6}}>
              {t.sentTitle}
            </div>
            <div style={{textAlign:"center", fontSize:13, color:"var(--ink-secondary)", lineHeight:1.5, padding:"0 8px", marginBottom:22}}>
              {t.sentSub}
            </div>

            {/* What we received — receipt card */}
            <div style={{
              background:"#fff",
              border:"1px solid var(--line)",
              borderRadius:14,
              padding:14,
              marginBottom:14,
            }}>
              <div className="muted tt" style={{marginBottom:8, fontWeight:600, letterSpacing:"0.05em"}}>RECEIVED · #SIG-{Math.floor(Math.random()*900+100)}</div>
              {selectedIssue && (
                <div style={{fontSize:13, fontWeight:600, color:"var(--ink-primary)", marginBottom:6}}>
                  {t.issues[ISSUES.find(i => i.id === selectedIssue).labelKey]}
                </div>
              )}
              {otherText && (
                <div style={{fontSize:12.5, color:"var(--ink-primary)", lineHeight:1.5, marginBottom:6, fontStyle:"italic"}}>"{otherText}"</div>
              )}
              {transcript && (
                <div style={{fontSize:12.5, color:"var(--ink-primary)", lineHeight:1.5, marginBottom:6, display:"flex", gap:6, alignItems:"flex-start"}}>
                  <I.mic size={12} style={{marginTop:2, color:"var(--accent)", flexShrink:0}}/>
                  <span>"{transcript}"</span>
                </div>
              )}
              {photos.length > 0 && (
                <div style={{marginTop:8, display:"flex", gap:6, flexWrap:"wrap"}}>
                  {photos.map(p => (
                    <div key={p.id} style={{width:36, height:36, borderRadius:6,
                      background:"linear-gradient(135deg, #c4d4e2, #8fa8bf)", border:"1px solid var(--line)"}}/>
                  ))}
                </div>
              )}
            </div>

            {/* Connection back to Engineer view */}
            <button onClick={goSeeChecking} style={{
              width:"100%", padding:"13px 14px", borderRadius:12,
              background:"#fff", border:"1.5px solid var(--accent)",
              color:"var(--accent)", fontWeight:600, fontSize:13, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"space-between",
              boxShadow:"0 1px 2px rgba(99,159,196,0.10)"
            }}>
              <span>{t.seeChecking}</span>
              <span style={{
                fontSize:11, fontWeight:500, padding:"3px 8px",
                background:"var(--accent-bg)", borderRadius:10,
                color:"var(--accent)"
              }}>INC-00001</span>
            </button>

            <div style={{marginTop:"auto", paddingTop:18, display:"flex", gap:8}}>
              <button onClick={reset} style={{
                flex:1, padding:"12px", borderRadius:12,
                background:"var(--bg-subtle)", color:"var(--ink-primary)",
                border:"1px solid var(--line)", fontWeight:600, fontSize:13, cursor:"pointer"
              }}>
                {t.sendAnother}
              </button>
            </div>
          </div>
        )}

        {/* No persistent toast anymore — it's a full-surface state */}
      </div>

      {showAnno && (
        <>
          <Anno tag="F1 · No jargon" style={{left:30, top:80}}>
            Zero instances of "AI", "LLM", "incident", "hypothesis", "8D", "agent", "initiative" on this screen. Only "what we noticed / we're checking".
          </Anno>
          <Anno tag="F2 · DE/EN toggle" style={{right:30, top:60, maxWidth:200}}>
            Defaults DE for Werk München. Toggle persists per-device.
          </Anno>
          <Anno tag="F3 · Live transcript" style={{left:30, top:280, maxWidth:220}}>
            Voice surface as it's being captured. User can review & remove before sending.
          </Anno>
          <Anno tag="F4 · 'Something else' opens text" style={{right:30, top:300, maxWidth:240}}>
            No more dead-end tile. Selecting it reveals an autofocused textarea — keeps the door open for anything our six tiles missed.
          </Anno>
          <Anno tag="F5 · Receipt + bridge" style={{right:30, bottom:80, maxWidth:240}}>
            Full-surface success state shows what we received, then offers an explicit bridge into the Engineer view (one tap → Canvas, focused on INC-00001). Closes the loop.
          </Anno>
        </>
      )}
    </div>
  );
}
window.FloorScreen = FloorScreen;
