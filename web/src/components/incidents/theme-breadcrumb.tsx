"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

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
      className="flex items-center gap-2 px-6 py-2.5 bg-primary/5 border-b border-primary/10"
    >
      <span className="text-[10px] uppercase tracking-widest font-mono font-semibold text-muted-foreground/80">
        Filtered by
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary pl-2.5 pr-1 py-0.5 font-mono text-xs font-bold">
        {signature}
        <Link
          href={clearHref}
          aria-label="Clear theme filter"
          className="inline-flex items-center justify-center size-4 rounded-full hover:bg-primary/20 transition-colors ml-1"
        >
          <X className="size-3" />
        </Link>
      </span>
    </div>
  );
};
