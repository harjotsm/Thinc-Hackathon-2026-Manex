"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = { signature: string };

export const ThemeBreadcrumb = ({ signature }: Props) => {
  const pathname = usePathname();
  const search = useSearchParams();

  const clearHref = (() => {
    const next = new URLSearchParams(search.toString());
    next.delete("theme");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  return (
    <div
      data-testid="theme-breadcrumb"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 24px",
        background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        fontSize: 12,
        color: "#1e40af",
      }}
    >
      <span>Filtered by theme:</span>
      <span style={{ fontWeight: 600 }}>{signature}</span>
      <Link
        href={clearHref}
        style={{
          marginLeft: 4,
          color: "#1e40af",
          textDecoration: "none",
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1,
        }}
        aria-label="Clear theme filter"
      >
        ×
      </Link>
    </div>
  );
};
