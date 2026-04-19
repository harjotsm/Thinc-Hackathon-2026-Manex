"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

const STATUS_OPTIONS: Option[] = [
  { value: "", label: "All statuses" },
  { value: "triage", label: "Triage" },
  { value: "reasoning", label: "Reasoning" },
  { value: "resolving", label: "Resolving" },
  { value: "closed", label: "Closed" },
];

const ARCHETYPE_OPTIONS: Option[] = [
  { value: "", label: "All archetypes" },
  { value: "supplier", label: "Supplier" },
  { value: "drift", label: "Drift" },
  { value: "design", label: "Design" },
  { value: "operator", label: "Operator" },
  { value: "unknown", label: "Unknown" },
];

const SEVERITY_OPTIONS: Option[] = [
  { value: "", label: "All severities" },
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
            variant={active ? "default" : "outline"}
            size="sm"
            className={cn("h-7 text-xs", active && "shadow-sm")}
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

export const IncidentsFilterStrip = () => {
  const search = useSearchParams();
  const status = search.get("status") ?? "";
  const archetype = search.get("archetype") ?? "";
  const severity = search.get("severity") ?? "";
  const windowDays = search.get("window_days") ?? "30";

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 bg-card border-b border-border">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Filter
      </span>
      <FilterPill
        active={status}
        label={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses"}
        options={STATUS_OPTIONS}
        param="status"
      />
      <FilterPill
        active={archetype}
        label={ARCHETYPE_OPTIONS.find((o) => o.value === archetype)?.label ?? "All archetypes"}
        options={ARCHETYPE_OPTIONS}
        param="archetype"
      />
      <FilterPill
        active={severity}
        label={SEVERITY_OPTIONS.find((o) => o.value === severity)?.label ?? "All severities"}
        options={SEVERITY_OPTIONS}
        param="severity"
      />
      <FilterPill
        active={windowDays === "30" ? "" : windowDays}
        label={WINDOW_OPTIONS.find((o) => o.value === windowDays)?.label ?? "Last 30d"}
        options={WINDOW_OPTIONS}
        param="window_days"
      />
    </div>
  );
};
