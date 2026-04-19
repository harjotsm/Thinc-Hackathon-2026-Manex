"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

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

const Pill = ({
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
  const [open, setOpen] = useState(false);
  const onPick = (v: string) => {
    const next = new URLSearchParams(search.toString());
    if (v) next.set(param, v); else next.delete(param);
    router.push(`${pathname}?${next.toString()}`);
    setOpen(false);
  };
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          color: active ? "white" : "#475569",
          background: active ? "#1e40af" : "transparent",
          padding: "3px 10px",
          borderRadius: 12,
          border: active ? "1px solid #1e40af" : "1px solid #e2e8f0",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: 6,
            zIndex: 10,
            minWidth: 160,
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 8px",
                background: "transparent",
                border: "none",
                fontSize: 12,
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "10px 24px",
        borderBottom: "1px solid #f1f5f9",
        fontSize: 11,
        background: "white",
      }}
    >
      <span style={{ color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>Filter</span>
      <Pill
        active={arch}
        label={ARCHETYPE_OPTIONS.find((o) => o.value === arch)?.label ?? "All archetypes"}
        options={ARCHETYPE_OPTIONS}
        param="archetype"
      />
      <Pill
        active={win === "7d" ? "" : win}
        label={WINDOW_OPTIONS.find((o) => o.value === win)?.label ?? "Last 7d"}
        options={WINDOW_OPTIONS}
        param="window"
      />
      <Pill
        active={product}
        label={product ? `Product: ${product}` : "All products"}
        options={[{ value: "", label: "All products" }]}
        param="product"
      />
      <Pill
        active={sev}
        label={SEVERITY_OPTIONS.find((o) => o.value === sev)?.label ?? "All severities"}
        options={SEVERITY_OPTIONS}
        param="severity"
      />
    </div>
  );
};
