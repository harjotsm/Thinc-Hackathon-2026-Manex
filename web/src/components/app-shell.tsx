"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PROTOTYPE_DATA } from "@/lib/prototype-data";

type NavItem = {
  href: string;
  label: string;
  section: "workspace" | "views" | "setup";
  icon: ReactNode;
  badge?: string | number;
  badgeHot?: boolean;
};

// ─── Live nav counts ──────────────────────────────────────────────────────────

type LiveCounts = {
  inbox: number | null;
  incidents: number | null;
  initiatives: number | null;
};

function useLiveNavCounts(): LiveCounts {
  const [counts, setCounts] = useState<LiveCounts>({
    inbox: null,
    incidents: null,
    initiatives: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const [themesRes, incidentsRes, initiativesRes] = await Promise.all([
          fetch("/api/themes?lens=engineer&window=7d").then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch("/api/incidents?page_size=1").then((r) =>
            r.ok ? r.json() : null,
          ),
          fetch("/api/initiatives?page_size=1").then((r) =>
            r.ok ? r.json() : null,
          ),
        ]);

        if (cancelled) return;

        const inbox =
          Array.isArray(themesRes?.themes)
            ? (themesRes.themes as unknown[]).length
            : null;
        const incidents =
          typeof incidentsRes?.pagination?.total === "number"
            ? incidentsRes.pagination.total
            : null;
        const initiatives =
          typeof initiativesRes?.pagination?.total === "number"
            ? initiativesRes.pagination.total
            : null;

        setCounts({ inbox, incidents, initiatives });
      } catch {
        // silently keep showing "—" on any network error
      }
    }

    void fetchCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

const navItems: NavItem[] = [
  {
    href: "/inbox",
    label: "Inbox",
    section: "workspace",
    // badge injected dynamically from useLiveNavCounts — see AppShell
    badgeHot: true,
    icon: (
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zm0 6.5h4l1.6 2h4.8L16 13h4" />
    ),
  },
  {
    href: "/incidents",
    label: "Incidents",
    section: "workspace",
    // badge injected dynamically from useLiveNavCounts — see AppShell
    icon: (
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />
    ),
  },
  {
    href: "/initiatives",
    label: "Initiatives",
    section: "workspace",
    // badge injected dynamically from useLiveNavCounts — see AppShell
    icon: (
      <path d="M5 6h14M5 12h9M5 18h14M16 9l3 3-3 3" />
    ),
  },
  {
    href: "/lessons",
    label: "Lessons",
    section: "workspace",
    icon: (
      <>
        <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H20v15.5A1.5 1.5 0 0 0 18.5 18H7.5A2.5 2.5 0 0 0 5 20.5z" />
        <path d="M8 8h7M8 11h9M8 14h8" />
      </>
    ),
  },
  {
    href: "/leadership",
    label: "Leadership",
    section: "views",
    icon: (
      <>
        <path d="M5 19V9M12 19V5M19 19v-8" />
        <path d="M4 19h16" />
      </>
    ),
  },
  {
    href: "/floor",
    label: "Floor",
    section: "views",
    icon: (
      <>
        <rect x="8" y="3.5" width="8" height="17" rx="2.5" />
        <path d="M10.5 6.5h3M11.5 17.5h1" />
      </>
    ),
  },
  {
    href: "/connectors",
    label: "Connectors",
    section: "setup",
    badge: "12",
    icon: (
      <path d="M8 7V5a2 2 0 1 1 4 0v2m0 10v2a2 2 0 1 0 4 0v-2M6 7h8v4H6zm4 6h8v4h-8z" />
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    section: "setup",
    icon: (
      <path d="m12 4 1.1 2.4 2.6.4-1.9 1.8.5 2.6L12 10l-2.3 1.2.5-2.6-1.9-1.8 2.6-.4zm0 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    ),
  },
];

function AppIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon-svg">
      {children}
    </svg>
  );
}

function routeMeta(pathname: string) {
  if (pathname.startsWith("/investigate/")) {
    const incidentId = pathname.split("/").at(-1) ?? "";
    return {
      crumbs: ["Engineer Lens", "Investigate", incidentId],
      title: "Incident investigation",
      subtitle: incidentId,
      lens: "Engineer",
    };
  }

  if (pathname.startsWith("/incident/")) {
    const parts = pathname.split("/").filter(Boolean);
    const incidentId = parts[1] ?? "INC-00001";
    const tail = parts[2];
    const label = tail === "8d" ? "8D Report" : tail === "resolve" ? "Resolve" : "Canvas";
    return {
      crumbs: ["Incidents", incidentId, label],
      title: label,
      subtitle: incidentId,
      lens: "Engineer",
    };
  }

  const map: Record<string, { crumbs: string[]; title: string; subtitle: string; lens: string }> = {
    "/": {
      crumbs: ["Resolve", "Home"],
      title: "Closed-loop quality intelligence",
      subtitle: "Workspace overview",
      lens: "Engineer",
    },
    "/inbox": {
      crumbs: ["Engineer Lens", "Inbox"],
      title: "Needs your attention",
      subtitle: "Active incidents and AI-ranked patterns",
      lens: "Engineer",
    },
    "/dashboard": {
      crumbs: ["Leadership Lens", "Dashboard"],
      title: "Leadership dashboard",
      subtitle: "Cross-incident metrics and quality pulse",
      lens: "Leadership",
    },
    "/leadership": {
      crumbs: ["Leadership Lens", "Dashboard"],
      title: "Leadership dashboard",
      subtitle: "Cross-incident metrics and quality pulse",
      lens: "Leadership",
    },
    "/capture": {
      crumbs: ["Floor Lens", "Capture"],
      title: "Signal capture",
      subtitle: "Report unusual behavior on the line",
      lens: "Floor",
    },
    "/floor": {
      crumbs: ["Floor Lens", "Capture"],
      title: "Signal capture",
      subtitle: "Report unusual behavior on the line",
      lens: "Floor",
    },
    "/incidents": {
      crumbs: ["Engineer Lens", "Incidents"],
      title: "Incident list",
      subtitle: "All active and recent incidents",
      lens: "Engineer",
    },
    "/initiatives": {
      crumbs: ["Engineer Lens", "Initiatives"],
      title: "Initiative tracker",
      subtitle: "Assigned follow-up actions across incidents",
      lens: "Engineer",
    },
    "/lessons": {
      crumbs: ["Engineer Lens", "Lessons"],
      title: "Lessons library",
      subtitle: "Resolved patterns and reusable fixes",
      lens: "Engineer",
    },
    "/connectors": {
      crumbs: ["Setup", "Connectors"],
      title: "Connector health",
      subtitle: "Data sources and sync status",
      lens: "Engineer",
    },
    "/settings": {
      crumbs: ["Setup", "Settings"],
      title: "Workspace settings",
      subtitle: "Preferences and environment configuration",
      lens: "Engineer",
    },
  };

  return (
    map[pathname] ?? {
      crumbs: ["Resolve"],
      title: "Workspace",
      subtitle: pathname,
      lens: "Engineer",
    }
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/inbox") return pathname === "/inbox" || pathname.startsWith("/investigate/");
  if (href === "/incidents") return pathname === "/incidents" || pathname.startsWith("/incident/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isFloorRoute = pathname === "/floor" || pathname === "/capture";
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("resolve.nav.collapsed") === "true";
  });
  const meta = useMemo(() => routeMeta(pathname), [pathname]);
  const liveCounts = useLiveNavCounts();

  // Merge live counts into navItems for rendering
  const resolvedNavItems = useMemo(
    () =>
      navItems.map((item) => {
        if (item.href === "/inbox") {
          const badge =
            liveCounts.inbox !== null ? liveCounts.inbox : "—";
          return { ...item, badge };
        }
        if (item.href === "/incidents") {
          const badge =
            liveCounts.incidents !== null ? liveCounts.incidents : "—";
          return { ...item, badge };
        }
        if (item.href === "/initiatives") {
          const badge =
            liveCounts.initiatives !== null ? liveCounts.initiatives : "—";
          return { ...item, badge };
        }
        return item;
      }),
    [liveCounts],
  );

  useEffect(() => {
    window.localStorage.setItem("resolve.nav.collapsed", String(collapsed));
  }, [collapsed]);

  if (isFloorRoute) {
    return <div className="floor-shell">{children}</div>;
  }

  return (
    <div className={`app-shell${collapsed ? " nav-collapsed" : ""}`}>
      <aside className={`nav${collapsed ? " collapsed" : ""}`}>
        <Link href="/" className="nav-brand">
          <Image src="/manex-mark.png" className="brand-mark" alt="Resolve by Manex" width={32} height={32} />
          {!collapsed && (
            <>
              <div>
                <div className="brand-name">Resolve</div>
                <div className="brand-kicker">by Manex</div>
              </div>
              <div className="brand-sub">v0.1</div>
            </>
          )}
        </Link>

        <button
          className="nav-collapse-btn"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>

        {(["workspace", "views", "setup"] as const).map((section) => (
          <div key={section}>
            {!collapsed && (
              <div className="nav-group">
                {section === "workspace" ? "Workspace" : section === "views" ? "Views" : "Setup"}
              </div>
            )}
            {collapsed && <div className="nav-sep" />}
            {resolvedNavItems
              .filter((item) => item.section === section)
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${isActive(pathname, item.href) ? " active" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="nav-icon">
                    <AppIcon>{item.icon}</AppIcon>
                  </span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                  {!collapsed && item.badge != null && (
                    <span className={`nav-badge${item.badgeHot ? " hot" : ""}`}>{item.badge}</span>
                  )}
                  {collapsed && item.badgeHot && item.badge != null ? <span className="nav-dot" /> : null}
                </Link>
              ))}
          </div>
        ))}

        <div className="nav-foot">
          <div className="user-chip">
            <div className="avatar">{PROTOTYPE_DATA.user.initials}</div>
            {!collapsed && (
              <div style={{ lineHeight: 1.25 }}>
                <div>{PROTOTYPE_DATA.user.name}</div>
                <div className="muted tt">{PROTOTYPE_DATA.user.role} · {PROTOTYPE_DATA.user.plant}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <div className="topbar">
          <div className="bc">
            {meta.crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`}>
                {index > 0 ? <span style={{ margin: "0 6px" }}>/</span> : null}
                {index === meta.crumbs.length - 1 ? <b>{crumb}</b> : crumb}
              </span>
            ))}
          </div>
          <div className="spacer" />
          <div className="cmdk">
            <span className="nav-icon">
              <AppIcon>
                <circle cx="11" cy="11" r="5.5" />
                <path d="m15.5 15.5 4 4" />
              </AppIcon>
            </span>
            <span>Search incidents, lessons, signals…</span>
            <span className="kbd">⌘K</span>
          </div>
          <div className="lens-switch" aria-label="Current lens">
            {["Engineer", "Floor", "Leadership"].map((lens) => (
              <button key={lens} className={meta.lens === lens ? "on" : ""} type="button">
                <span className="licon">
                  {lens === "Engineer" ? (
                    <AppIcon>
                      <>
                        <path d="M5 19V9M12 19V5M19 19v-8" />
                        <path d="M4 19h16" />
                      </>
                    </AppIcon>
                  ) : lens === "Floor" ? (
                    <AppIcon>
                      <>
                        <rect x="8" y="3.5" width="8" height="17" rx="2.5" />
                        <path d="M10.5 6.5h3M11.5 17.5h1" />
                      </>
                    </AppIcon>
                  ) : (
                    <AppIcon>
                      <>
                        <path d="M4 18h16" />
                        <path d="M6 15V9m6 6V6m6 9v-4" />
                      </>
                    </AppIcon>
                  )}
                </span>
                <span className="llabel">{lens}</span>
              </button>
            ))}
          </div>
          <button className="btn ghost sm" type="button">Show notes</button>
        </div>

        <div className="page-shell">
          {children}
        </div>
      </div>
    </div>
  );
}
