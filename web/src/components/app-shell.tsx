"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  Factory,
  Inbox,
  Layers,
  ListChecks,
  Plug,
  Search,
  Settings,
  Wrench,
} from "lucide-react";
import { PROTOTYPE_DATA } from "@/lib/prototype-data";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type NavItem = {
  href: string;
  label: string;
  section: "workspace" | "views" | "setup";
  icon: ReactNode;
  badge?: string | number | null;
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
        // silently keep showing Skeleton on any network error
      }
    }

    void fetchCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}

const ICON_SIZE = 16;

const navItems: NavItem[] = [
  {
    href: "/inbox",
    label: "Inbox",
    section: "workspace",
    badgeHot: true,
    icon: <Inbox size={ICON_SIZE} />,
  },
  {
    href: "/incidents",
    label: "Incidents",
    section: "workspace",
    icon: <AlertTriangle size={ICON_SIZE} />,
  },
  {
    href: "/initiatives",
    label: "Initiatives",
    section: "workspace",
    icon: <ListChecks size={ICON_SIZE} />,
  },
  {
    href: "/lessons",
    label: "Lessons",
    section: "workspace",
    icon: <BookOpen size={ICON_SIZE} />,
  },
  // Leadership / Floor live in the top-right lens switcher only — duplicating
  // them in the sidebar makes the lens concept feel redundant.
  {
    href: "/connectors",
    label: "Connectors",
    section: "setup",
    badge: "12",
    icon: <Plug size={ICON_SIZE} />,
  },
  {
    href: "/settings",
    label: "Settings",
    section: "setup",
    icon: <Settings size={ICON_SIZE} />,
  },
];

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

function NavBadge({
  count,
  hot,
}: {
  count: number | string | null | undefined;
  hot?: boolean;
}) {
  if (count === null) {
    return <Skeleton className="ml-auto h-4 w-6 rounded-full" />;
  }
  if (count === undefined) return null;
  return (
    <Badge
      variant={hot ? "default" : "secondary"}
      className={cn(
        "ml-auto h-5 text-[10px] font-semibold px-1.5",
      )}
    >
      {count}
    </Badge>
  );
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

  const resolvedNavItems = useMemo(
    () =>
      navItems.map((item) => {
        if (item.href === "/inbox") {
          return { ...item, badge: liveCounts.inbox };
        }
        if (item.href === "/incidents") {
          return { ...item, badge: liveCounts.incidents };
        }
        if (item.href === "/initiatives") {
          return { ...item, badge: liveCounts.initiatives };
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
    <div
      className={cn(
        "grid min-h-screen w-full bg-muted/40",
        collapsed
          ? "grid-cols-[56px_minmax(0,1fr)]"
          : "grid-cols-[232px_minmax(0,1fr)]",
      )}
    >
      <aside
        className={cn(
          "relative flex flex-col bg-card border-r border-border",
          collapsed ? "px-1.5 py-3.5 items-center" : "px-2.5 py-3.5",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 pb-4 mb-2.5 border-b border-border",
            collapsed ? "justify-center w-full" : "px-2",
          )}
        >
          <Image
            src="/manex-mark.png"
            alt="Resolve by Manex"
            width={28}
            height={28}
            className="shrink-0 object-contain"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold tracking-tight leading-tight">
                Resolve
              </div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold leading-tight">
                by Manex
              </div>
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-5 -right-3 flex size-6 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:border-primary hover:text-primary shadow-sm transition-colors z-20"
        >
          <span className="leading-none text-sm">
            {collapsed ? "›" : "‹"}
          </span>
        </button>

        <nav className="flex flex-col gap-0.5 w-full">
          {(["workspace", "setup"] as const).map((section) => {
            const sectionItems = resolvedNavItems.filter(
              (item) => item.section === section,
            );
            if (sectionItems.length === 0) return null;
            return (
            <div key={section} className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
              {!collapsed && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2.5 pt-3.5 pb-1">
                  {section === "workspace" ? "Workspace" : "Setup"}
                </div>
              )}
              {collapsed && <div className="h-px w-6 bg-border my-2" />}
              {sectionItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                        collapsed
                          ? "size-10 justify-center"
                          : "px-2.5 py-1.5",
                        active
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground/75 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {active && !collapsed ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-full"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "shrink-0 flex items-center justify-center",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          <NavBadge count={item.badge} hot={item.badgeHot} />
                        </>
                      )}
                      {collapsed && item.badgeHot && item.badge != null ? (
                        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary ring-2 ring-card" />
                      ) : null}
                    </Link>
                  );
                })}
            </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-3 border-t border-border w-full">
          <div
            className={cn(
              "flex items-center gap-2.5 px-2 py-1",
              collapsed && "justify-center px-0",
            )}
          >
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {PROTOTYPE_DATA.user.initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-xs font-semibold truncate">
                  {PROTOTYPE_DATA.user.name}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {PROTOTYPE_DATA.user.role} · {PROTOTYPE_DATA.user.plant}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex flex-col min-w-0 min-h-screen">
        <div className="bg-card border-b border-border flex items-center gap-3 px-5 min-h-[52px] flex-shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {meta.crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? <span className="text-muted-foreground/40">/</span> : null}
                <span className={cn(index === meta.crumbs.length - 1 && "text-foreground font-semibold")}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          <div className="flex-1" />
          <div className="relative hidden lg:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search…"
              className="h-8 w-48 xl:w-72 pl-8 pr-12 bg-muted/40 border-border text-xs"
            />
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </div>
          <div
            role="tablist"
            aria-label="Current lens"
            className="inline-flex items-center gap-0.5 p-0.5 bg-muted/60 border border-border rounded-md"
          >
            {(
              [
                { name: "Engineer", href: "/inbox" },
                { name: "Floor", href: "/floor" },
                { name: "Leadership", href: "/leadership" },
              ] as const
            ).map(({ name, href }) => {
              const active = meta.lens === name;
              const Icon =
                name === "Engineer" ? Wrench : name === "Floor" ? Factory : Layers;
              return (
                <Link
                  key={name}
                  href={href}
                  role="tab"
                  aria-selected={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={12} />
                  <span className="hidden xl:inline">{name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-auto relative bg-muted/30">
          {children}
        </div>
      </div>
    </div>
  );
}
