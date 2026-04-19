"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
      className="flex items-center gap-2 px-6 py-2 bg-primary/5 border-b border-primary/10"
    >
      <span className="text-xs text-muted-foreground">Filtered by theme:</span>
      <Badge
        variant="secondary"
        className="text-xs font-mono font-semibold gap-1 pr-1"
      >
        {signature}
        <Link
          href={clearHref}
          aria-label="Clear theme filter"
          className="inline-flex items-center justify-center size-4 rounded hover:bg-foreground/10 transition-colors"
        >
          <X className="size-3" />
        </Link>
      </Badge>
    </div>
  );
};
