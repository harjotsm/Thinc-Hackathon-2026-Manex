"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

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

// ─── Pill ────────────────────────────────────────────────────────────────────

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
    if (v) next.set(param, v);
    else next.delete(param);
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

// ─── Filter strip ─────────────────────────────────────────────────────────────

export const IncidentsFilterStrip = () => {
  const search = useSearchParams();
  const status = search.get("status") ?? "";
  const archetype = search.get("archetype") ?? "";
  const severity = search.get("severity") ?? "";
  const windowDays = search.get("window_days") ?? "30";

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
      <span style={{ color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em" }}>
        Filter
      </span>
      <Pill
        active={status}
        label={STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "All statuses"}
        options={STATUS_OPTIONS}
        param="status"
      />
      <Pill
        active={archetype}
        label={ARCHETYPE_OPTIONS.find((o) => o.value === archetype)?.label ?? "All archetypes"}
        options={ARCHETYPE_OPTIONS}
        param="archetype"
      />
      <Pill
        active={severity}
        label={SEVERITY_OPTIONS.find((o) => o.value === severity)?.label ?? "All severities"}
        options={SEVERITY_OPTIONS}
        param="severity"
      />
      <Pill
        active={windowDays === "30" ? "" : windowDays}
        label={WINDOW_OPTIONS.find((o) => o.value === windowDays)?.label ?? "Last 30d"}
        options={WINDOW_OPTIONS}
        param="window_days"
      />
    </div>
  );
};
