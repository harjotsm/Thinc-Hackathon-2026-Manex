// Seeded scenario data. Consistent across ALL screens per constraints:
//  - User: M. Bauer · Plant Quality · Werk München
//  - Time: mid-afternoon; freshest signal "2 min ago", correlator opened INC "17 min ago"
//  - Open incidents: 14
//  - Primary incident: INC-00001 (supplier batch SB-00007)

const DATA = {
  user: {
    name: "M. Bauer",
    role: "Plant Quality",
    plant: "Werk München",
    initials: "MB",
    // Role-based access. Current user is an engineer — sees only the Engineer lens.
    // Floor roles (line operators) get Floor only. Leadership roles get Leadership.
    canAccessEngineer: true,
    canAccessFloor: true,
    canAccessLeadership: true,
  },
  now: "14:42",
  shift: "Shift 2",

  counts: {
    openIncidents: 14,
    activeInitiatives: 37,
    lessonsApplied: 9,
    costAtRisk: "€312k",
  },

  // Top 5 for Landing
  topIncidents: [
    { id:"INC-00001", sev:"high", title:"Supplier batch SB-00007 — cold solder cluster", product:"PM-00008", signals:17, age:"17 min", assignee:"MB", conf:82, primary:true },
    { id:"INC-00014", sev:"high", title:"Thermal drift R33 — field claims spike", product:"PM-00012", signals:9, age:"2h", assignee:"AK", conf:71 },
    { id:"INC-00009", sev:"med", title:"Torque drift — Linie 1 assembly", product:"PM-00003", signals:6, age:"5h", assignee:"MB", conf:64 },
    { id:"INC-00011", sev:"med", title:"Rework pattern — operator concentration", product:"PM-00005", signals:4, age:"1d", assignee:"—", conf:58 },
    { id:"INC-00012", sev:"low", title:"Scratch cluster — Montage Linie 1", product:"PM-00008", signals:3, age:"4h", assignee:"MB", conf:49 },
  ],

  // Primary incident detail (INC-00001)
  incident: {
    id: "INC-00001",
    title: "Supplier batch SB-00007 — cold solder cluster",
    severity: "high",
    status: "reasoning",
    opened: "17 min ago",
    product: "PM-00008",
    productName: "Power Module PM-00008",
    part: "R33 (resistor array)",
    supplier: "ElektroParts GmbH",
    batch: "SB-00007",
    signals: [
      { id:"SIG-412", src:"Warranty", srcIcon:"mail", sev:"high", time:"2 min ago",  text:"Totalausfall nach 4 Wochen Betrieb. Kunde meldet thermische Auslösung.", ref:"PRD-00712 · PM-00008" },
      { id:"SIG-411", src:"Warranty", srcIcon:"mail", sev:"high", time:"14 min ago", text:"Device shuts down intermittently under load.", ref:"PRD-00709 · PM-00008" },
      { id:"SIG-408", src:"Inbound-Inspection", srcIcon:"truck", sev:"med", time:"42 min ago", text:"ESR reading 0.28Ω on batch SB-00007 (spec ≤0.22Ω)", ref:"SB-00007 · ElektroParts" },
      { id:"SIG-399", src:"EOL-Test", srcIcon:"chart", sev:"med", time:"1h 10m", text:"Near-miss: test_value within 4% of lower limit, 3× on shift 2.", ref:"PM-00008 · Linie 1" },
      { id:"SIG-387", src:"SPC-Drift", srcIcon:"trend", sev:"med", time:"2h", text:"Cpk erosion on R33 mounting station (1.41 → 1.06).", ref:"PM-00008 · Stn-04" },
      { id:"SIG-361", src:"Warranty", srcIcon:"mail", sev:"high", time:"1d", text:"Premature failure in the field, 6 weeks installed.", ref:"PRD-00688 · PM-00008" },
      { id:"SIG-358", src:"Voice", srcIcon:"mic", sev:"low", time:"1d", text:'"Diese Charge fühlt sich nicht richtig an." — Markus L., Linie 1', ref:"Voice · Montage Linie 1" },
      { id:"SIG-340", src:"Social", srcIcon:"mail", sev:"low", time:"2d", text:"Trustpilot: 'Unit died after a month, warranty was easy though.'", ref:"Public review" },
    ],
    nearMiss: [
      { id:"SIG-393", text:"EOL test within 5% of limit", src:"EOL-Test" },
      { id:"SIG-381", text:"Inbound inspection: borderline lead finish", src:"Inbound-Inspection" },
      { id:"SIG-377", text:"Voice of floor: 'solder looks dull'", src:"Voice" },
    ],
    hypotheses: [
      { id:"HYP-material", label:"MATERIAL", title:"Supplier batch SB-00007 ESR out of spec", conf:82, primary:true, evidence:5, contradict:0, confirmed:true },
      { id:"HYP-process",  label:"PROCESS",  title:"Reflow profile drift, Stn-04",           conf:38, evidence:2, contradict:3 },
      { id:"HYP-design",   label:"DESIGN",   title:"Thermal margin of R33 footprint",        conf:24, evidence:1, contradict:2, speculation:true },
      { id:"HYP-operator", label:"OPERATOR", title:"Manual placement variance, Shift 2",     conf:9,  evidence:0, contradict:4, speculation:true },
    ],
    contributions: [
      { domain:"Supplier Quality",       icon:"truck",   status:"live",        text:"ESR screening: batch SB-00007 elevated across 63/120 parts. Supplier cert discrepancy." },
      { domain:"Central Quality",        icon:"users",   status:"contributed", text:"Similar signature resolved 2023-09 at Werk Hamburg. See LES-018." },
      { domain:"Business Analytics",     icon:"chart",   status:"live",        text:"Warranty accrual exposure €48-92k over 12 weeks. 340 units at risk." },
      { domain:"Plant Q — direct",       icon:"factory", status:"contributed", text:"Rework concentrated on 3 operators; all worked Stn-04 on affected dates." },
      { domain:"Plant Q — indirect",     icon:"factory", status:"pending",     text:"SPC context requested." },
      { domain:"Process Planner",        icon:"flow",    status:"pending",     text:"" },
      { domain:"Technology Planning",    icon:"flask",   status:"pending",     text:"" },
      { domain:"Market Research",        icon:"chart",   status:"dismissed",   text:"" },
      { domain:"Marketing",              icon:"mail",    status:"pending",     text:"" },
    ],
  },

  agents: [
    { id:"A-prod",  name:"Production Agent",        icon:"factory", target:"MES",  draft:"Quarantine all products built with batch SB-00007 on Werk München Linie 1 (est. 340 units). Insert inspection step at Stn-04 pending batch clearance.", owner:"M. Bauer", due:"2026-04-22", priority:"High", impact:"+ prevents ~8 claims over 12 weeks" },
    { id:"A-sup",   name:"Supplier Agent",          icon:"truck",   target:"SRM",  draft:"Issue supplier 8D to ElektroParts GmbH citing batch SB-00007. Demand 100% ESR screening on next 3 deliveries. Update supplier scorecard; hold PO-22918 shipments.", owner:"J. Keller", due:"2026-04-23", priority:"High", impact:"Resolves upstream" },
    { id:"A-rd",    name:"R&D / Dev Agent",         icon:"flask",   target:"Jira", draft:"Add ESR tolerance check to PM-00008 acceptance spec. File FMEA revision (R33 material grade). Draft spec-rev ticket.", owner:"S. Müller", due:"2026-04-29", priority:"Med",  impact:"Prevents recurrence" },
    { id:"A-log",   name:"Logistics Agent",         icon:"box",     target:"ERP",  draft:"Hold shipments of PO range POX-221xx containing affected serials. Reroute inventory from Werk Hamburg to fulfill open orders.", owner:"T. Roth",    due:"2026-04-20", priority:"High", impact:"Minimizes exposure" },
    { id:"A-cust",  name:"Customer-Response Agent", icon:"mail",    target:"CRM",  draft:"Proactive outreach to 340 customers with affected serials. Draft technician-validated email + service-visit scheduling. Flag warranty reserve.", owner:"L. Ahmed",   due:"2026-04-25", priority:"Med",  impact:"+ prevents ~3 claims" },
  ],

  initiatives: [
    { col:"todo",    id:"INI-091", title:"Quarantine SB-00007 serials", agent:"factory", target:"MES",  owner:"MB", due:"2d",  impact:"+8 claims" },
    { col:"todo",    id:"INI-092", title:"Supplier 8D → ElektroParts",   agent:"truck",   target:"SRM",  owner:"JK", due:"3d",  impact:"upstream" },
    { col:"progress",id:"INI-088", title:"Torque audit Linie 1",         agent:"factory", target:"MES",  owner:"MB", due:"1d",  impact:"SPC recovery" },
    { col:"progress",id:"INI-089", title:"FMEA revision R33",            agent:"flask",   target:"Jira", owner:"SM", due:"9d",  impact:"prevent" },
    { col:"progress",id:"INI-093", title:"Hold PO-22918 shipments",      agent:"box",     target:"ERP",  owner:"TR", due:"—",   impact:"exposure" },
    { col:"blocked", id:"INI-081", title:"Dealer network comms",         agent:"mail",    target:"CRM",  owner:"LA", due:"—",   impact:"wait legal" },
    { col:"verify",  id:"INI-074", title:"Rework SOP update",            agent:"factory", target:"MES",  owner:"MB", due:"—",   impact:"verify 72h" },
    { col:"verify",  id:"INI-077", title:"ESR screen POC",               agent:"truck",   target:"SRM",  owner:"JK", due:"—",   impact:"inline" },
    { col:"closed",  id:"INI-061", title:"Scratch inspection gate",      agent:"factory", target:"MES",  owner:"MB", due:"—",   impact:"done" },
    { col:"closed",  id:"INI-058", title:"Heat warning SOP rev",         agent:"flask",   target:"Jira", owner:"SM", due:"—",   impact:"done" },
  ],

  lessons: [
    { id:"LES-018", sig:"Cold solder cluster from a specific supplier batch", fix:"Quarantine batch, ESR inbound screen, supplier 8D.", applied:14, plants:3, outcome:"resolved", trend:[3,5,4,2,1,1,0,0] },
    { id:"LES-022", sig:"Thermal drift — R33 footprint under load",          fix:"Spec revision, expanded copper pour, inbound thermal screen.", applied:7, plants:2, outcome:"resolved", trend:[4,3,3,2,2,1,1,0] },
    { id:"LES-014", sig:"Torque drift at assembly Stn-04",                   fix:"Calibration interval halved, torque-wrench IoT check.", applied:11, plants:4, outcome:"resolved", trend:[5,4,2,2,1,1,0,0] },
    { id:"LES-031", sig:"Rework concentration on Shift 2",                   fix:"Retraining + peer-review gate.", applied:4, plants:1, outcome:"recurring", trend:[2,2,1,2,3,1,2,1] },
    { id:"LES-009", sig:"Label misprint — Linie 3",                          fix:"Printer calibration alert, double-verify scan.", applied:19, plants:5, outcome:"resolved", trend:[6,4,3,1,1,0,0,0] },
    { id:"LES-027", sig:"EOL test near-miss clustering",                     fix:"Flag near-miss as signal, not noise.", applied:8, plants:3, outcome:"resolved", trend:[4,3,2,2,1,1,1,0] },
  ],

  connectors: [
    { group:"Internal — Production", items:[
      { name:"MES — End-of-Line Tests",        status:"connected", sigs:1284, last:"2 min ago",  kind:"chart" },
      { name:"MES — SPC / Cpk Drift",          status:"connected", sigs:96,   last:"6 min ago",  kind:"trend" },
      { name:"Voice of Floor",                 status:"connected", sigs:41,   last:"2 min ago",  kind:"mic" },
      { name:"Rework Pattern Detector",        status:"connected", sigs:18,   last:"22 min ago", kind:"factory" },
      { name:"Maintenance Calendar",           status:"partial",   sigs:4,    last:"3h ago",     kind:"clock" },
      { name:"FMEA Registry",                  status:"connected", sigs:7,    last:"1d ago",     kind:"flask" },
    ]},
    { group:"Internal — Supply Chain", items:[
      { name:"Supplier Inbound Inspection",    status:"connected", sigs:63,   last:"42 min ago", kind:"truck" },
      { name:"SRM Scorecards",                 status:"connected", sigs:12,   last:"1h ago",     kind:"users" },
      { name:"ERP / WMS",                      status:"partial",   sigs:8,    last:"4h ago",     kind:"box" },
    ]},
    { group:"External — Customer", items:[
      { name:"Warranty CRM",                   status:"connected", sigs:214,  last:"2 min ago",  kind:"mail" },
      { name:"Dealer Network",                 status:"connected", sigs:38,   last:"28 min ago", kind:"users" },
      { name:"NPS / CX Surveys",               status:"connected", sigs:9,    last:"2h ago",     kind:"chart" },
      { name:"IoT Telemetry",                  status:"partial",   sigs:71,   last:"3 min ago",  kind:"wave" },
    ]},
    { group:"External — Market", items:[
      { name:"Social Listening",               status:"connected", sigs:6,    last:"1h ago",     kind:"mail" },
      { name:"Call-center Transcripts",        status:"disconnected", sigs:0, last:"—",          kind:"mic" },
    ]},
  ],

  // Inbox queue rows
  inbox: [
    { sev:"high", id:"INC-00001", title:"Supplier batch SB-00007 — cold solder cluster", product:"PM-00008", sources:["mail","truck","chart","mic"], count:17, first:"1d", last:"2 min ago", owner:"MB", status:"reasoning", conf:82, primary:true },
    { sev:"high", id:"INC-00014", title:"Thermal drift R33 — field claims spike",       product:"PM-00012", sources:["mail","wave"], count:9, first:"3d", last:"2h", owner:"AK", status:"reasoning", conf:71 },
    { sev:"med",  id:"INC-00009", title:"Torque drift — Linie 1 assembly",               product:"PM-00003", sources:["trend","factory"], count:6, first:"12h", last:"5h", owner:"MB", status:"triage", conf:64 },
    { sev:"med",  id:"INC-00011", title:"Rework pattern — operator concentration",      product:"PM-00005", sources:["factory"], count:4, first:"2d", last:"1d", owner:"—", status:"triage", conf:58 },
    { sev:"low",  id:"INC-00012", title:"Scratch cluster — Montage Linie 1",             product:"PM-00008", sources:["mic","factory"], count:3, first:"6h", last:"4h", owner:"MB", status:"triage", conf:49 },
    { sev:"low",  id:"INC-00013", title:"Label misprint — Linie 3",                      product:"PM-00003", sources:["factory"], count:2, first:"1d", last:"8h", owner:"—", status:"triage", conf:44 },
    { sev:"med",  id:"INC-00010", title:"NPS drop on PM-00012 (EU region)",              product:"PM-00012", sources:["chart","mail"], count:12, first:"4d", last:"3h", owner:"AK", status:"reasoning", conf:52 },
  ],

  // Floor lens reports
  floorReports: [
    { status:"Triaged",      text:"Housing scratch, 3rd this shift",   time:"12 min ago" },
    { status:"Investigating", text:"Batch feels off at Stn-04",          time:"1h ago" },
    { status:"Resolved",      text:"Wrong label, Linie 3",               time:"yesterday" },
  ],

  // Leadership
  pareto: [
    { code:"Cold solder — SB-00007", cost:92,  primary:true },
    { code:"Thermal drift R33",      cost:74,  primary:true },
    { code:"Torque drift Stn-04",    cost:58,  primary:true },
    { code:"Rework Shift 2",         cost:34 },
    { code:"Scratch housing",        cost:22 },
    { code:"Label misprint L3",      cost:14 },
    { code:"ESR borderline",         cost:11 },
    { code:"IoT signal dropout",     cost:8 },
  ],
  plants: [
    { name:"Werk München",  inc:14, hot:true },
    { name:"Werk Hamburg",  inc:6 },
    { name:"Werk Leipzig",  inc:4 },
    { name:"Planta Valencia", inc:9 },
    { name:"Usine Lyon",    inc:3 },
    { name:"Brno Plant",    inc:7 },
  ],
};

window.DATA = DATA;
