// Minimal Lucide-style icon set. Small, consistent stroke.
const Icon = ({ d, size = 14, fill = "none", extra }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    {typeof d === "string" ? <path d={d} /> : d}
    {extra}
  </svg>
);

const I = {
  inbox:   (p) => <Icon {...p} d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />,
  incident:(p) => <Icon {...p} d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
  flow:    (p) => <Icon {...p} extra={<><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="5" cy="18" r="2"/><path d="M7 6h10a2 2 0 0 1 2 2v8M5 8v8"/></>} />,
  book:    (p) => <Icon {...p} d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />,
  plug:    (p) => <Icon {...p} d="M12 2v6M8 2v6M6 8h12v3a6 6 0 0 1-12 0V8zM12 14v8" />,
  settings:(p) => <Icon {...p} extra={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>} />,
  search:  (p) => <Icon {...p} extra={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>} />,
  mic:     (p) => <Icon {...p} d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />,
  factory: (p) => <Icon {...p} d="M2 20V8l6 4V8l6 4V4h6v16H2zM6 16h2M12 16h2M18 16h-2" />,
  truck:   (p) => <Icon {...p} extra={<><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>} />,
  flask:   (p) => <Icon {...p} d="M10 2v7.31L4 19a3 3 0 0 0 2.54 4.59h10.92A3 3 0 0 0 20 19l-6-9.69V2M8 2h8M7 15h10" />,
  box:     (p) => <Icon {...p} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
  mail:    (p) => <Icon {...p} extra={<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></>} />,
  chev:    (p) => <Icon {...p} d="m9 18 6-6-6-6" />,
  chevd:   (p) => <Icon {...p} d="m6 9 6 6 6-6" />,
  plus:    (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  check:   (p) => <Icon {...p} d="M20 6 9 17l-5-5" />,
  x:       (p) => <Icon {...p} d="M18 6 6 18M6 6l12 12" />,
  spark:   (p) => <Icon {...p} d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  bolt:    (p) => <Icon {...p} d="m13 2-3 14h7l-4 6 10-14h-7l4-6H13z" fill="currentColor" />,
  clock:   (p) => <Icon {...p} extra={<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>} />,
  play:    (p) => <Icon {...p} d="M8 5v14l11-7z" fill="currentColor" />,
  undo:    (p) => <Icon {...p} d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />,
  link:    (p) => <Icon {...p} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />,
  eye:     (p) => <Icon {...p} extra={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>} />,
  grid:    (p) => <Icon {...p} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  list:    (p) => <Icon {...p} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  filter:  (p) => <Icon {...p} d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  map:     (p) => <Icon {...p} d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16" />,
  users:   (p) => <Icon {...p} extra={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>} />,
  chart:   (p) => <Icon {...p} d="M3 3v18h18M7 12l4-4 4 4 5-6" />,
  split:   (p) => <Icon {...p} d="M3 12h18M3 6h18M3 18h18" />,
  dots:    (p) => <Icon {...p} extra={<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>} />,
  pencil:  (p) => <Icon {...p} d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />,
  back:    (p) => <Icon {...p} d="m15 18-6-6 6-6" />,
  trend:   (p) => <Icon {...p} d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />,
  mobile:  (p) => <Icon {...p} d="M5 2h14a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01" />,
  wave:    (p) => <Icon {...p} d="M2 12h2l2-6 4 12 4-18 4 12 2-6h2" />,
};

window.I = I;
