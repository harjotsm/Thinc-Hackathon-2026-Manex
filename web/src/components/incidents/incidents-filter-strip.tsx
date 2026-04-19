"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const STATUS_OPTIONS: Option[] = [
  { value: "", label: "All" },
  { value: "triage", label: "Triage" },
  { value: "reasoning", label: "Reasoning" },
  { value: "resolving", label: "Resolving" },
  { value: "closed", label: "Closed" },
];

const ARCHETYPE_OPTIONS: Option[] = [
  { value: "", label: "Any" },
  { value: "supplier", label: "Supplier" },
  { value: "drift", label: "Drift" },
  { value: "design", label: "Design" },
  { value: "operator", label: "Operator" },
  { value: "unknown", label: "Triage" },
];

const SEVERITY_OPTIONS: Option[] = [
  { value: "", label: "Any" },
  { value: "high,critical", label: "High & Critical" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const WINDOW_OPTIONS: Option[] = [
  { value: "30", label: "Last 30d" },
  { value: "7", label: "Last 7d" },
  { value: "1", label: "Last 1d" },
];

const FilterPill = ({
  active,
  label,
  options,
  param,
}: {
  active: string;
  label: string;
  options: Option[];
  param: string;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const onPick = (v: string) => {
    const next = new URLSearchParams(search.toString());
    if (v) next.set(param, v);
    else next.delete(param);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={active ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 px-2.5 rounded-full text-xs font-semibold gap-1",
              active
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-foreground/80 hover:bg-muted",
            )}
          />
        }
      >
        <span>{label}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value || "__empty"}
            onClick={() => onPick(o.value)}
            className="text-xs"
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70 font-bold mr-1.5">
    {children}
  </span>
);

const SeverityDots = ({ active }: { active: string }) => {
  const enabled = (sev: string) => active === "" || active.split(",").includes(sev);
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {(["low", "medium", "high", "critical"] as const).map((sev) => (
        <span
          key={sev}
          aria-label={sev}
          className="size-2 rounded-full transition-opacity"
          style={{
            backgroundColor:
              sev === "low"
                ? "var(--sev-low)"
                : sev === "medium"
                  ? "var(--sev-med)"
                  : sev === "high"
                    ? "var(--sev-high)"
                    : "var(--sev-crit)",
            opacity: enabled(sev) ? 1 : 0.25,
          }}
        />
      ))}
    </span>
  );
};

export const IncidentsFilterStrip = () => {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const status = search.get("status") ?? "";
  const archetype = search.get("archetype") ?? "";
  const severity = search.get("severity") ?? "";
  const windowDays = search.get("window_days") ?? "30";
  const q = search.get("q") ?? "";

  const onSearch = (next: string) => {
    const params = new URLSearchParams(search.toString());
    if (next) params.set("q", next);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-6 py-2.5 bg-card border-b border-border">
      <span className="inline-flex items-center">
        <Eyebrow>Status</Eyebrow>
        <FilterPill
          active={status}
          label={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All"}
          options={STATUS_OPTIONS}
          param="status"
        />
      </span>
      <span className="inline-flex items-center">
        <Eyebrow>Archetype</Eyebrow>
        <FilterPill
          active={archetype}
          label={ARCHETYPE_OPTIONS.find((o) => o.value === archetype)?.label ?? "Any"}
          options={ARCHETYPE_OPTIONS}
          param="archetype"
        />
      </span>
      <span className="inline-flex items-center">
        <Eyebrow>Severity</Eyebrow>
        <FilterPill
          active={severity}
          label={SEVERITY_OPTIONS.find((o) => o.value === severity)?.label ?? "Any"}
          options={SEVERITY_OPTIONS}
          param="severity"
        />
        <SeverityDots active={severity} />
      </span>

      <div className="flex-1" />

      <span className="inline-flex items-center">
        <Eyebrow>Window</Eyebrow>
        <FilterPill
          active={windowDays === "30" ? "" : windowDays}
          label={WINDOW_OPTIONS.find((o) => o.value === windowDays)?.label ?? "Last 30d"}
          options={WINDOW_OPTIONS}
          param="window_days"
        />
      </span>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          defaultValue={q}
          onBlur={(e) => onSearch(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch(e.currentTarget.value);
          }}
          placeholder="Filter incidents…"
          className="h-7 w-44 pl-7 text-xs bg-background/60 border-border rounded-full"
        />
      </div>
    </div>
  );
};
