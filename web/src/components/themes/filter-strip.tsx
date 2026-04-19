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
const ARCHETYPE_OPTIONS: Option[] = [
  { value: "", label: "All archetypes" },
  { value: "supplier", label: "Supplier" },
  { value: "drift", label: "Drift" },
  { value: "design", label: "Design" },
  { value: "operator", label: "Operator" },
  { value: "unknown", label: "Unknown" },
];
const WINDOW_OPTIONS: Option[] = [
  { value: "1d", label: "Last 1d" },
  { value: "7d", label: "Last 7d" },
  { value: "30d", label: "Last 30d" },
];
const SEVERITY_OPTIONS: Option[] = [
  { value: "", label: "All severities" },
  { value: "high,critical", label: "High & Critical" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
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
            className={cn(
              "h-7 text-xs",
              active && "shadow-sm",
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

export const FilterStrip = () => {
  const search = useSearchParams();
  const arch = search.get("archetype") ?? "";
  const win = search.get("window") ?? "7d";
  const product = search.get("product") ?? "";
  const sev = search.get("severity") ?? "";
  return (
    <div
      data-testid="filter-strip"
      className="flex items-center gap-2 px-6 py-2.5 bg-card border-b border-border"
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Filter
      </span>
      <FilterPill
        active={arch}
        label={ARCHETYPE_OPTIONS.find((o) => o.value === arch)?.label ?? "All archetypes"}
        options={ARCHETYPE_OPTIONS}
        param="archetype"
      />
      <FilterPill
        active={win === "7d" ? "" : win}
        label={WINDOW_OPTIONS.find((o) => o.value === win)?.label ?? "Last 7d"}
        options={WINDOW_OPTIONS}
        param="window"
      />
      <FilterPill
        active={product}
        label={product ? `Product: ${product}` : "All products"}
        options={[{ value: "", label: "All products" }]}
        param="product"
      />
      <FilterPill
        active={sev}
        label={SEVERITY_OPTIONS.find((o) => o.value === sev)?.label ?? "All severities"}
        options={SEVERITY_OPTIONS}
        param="severity"
      />
    </div>
  );
};
