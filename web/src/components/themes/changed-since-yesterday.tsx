import { ArrowUpRight, AlertTriangle, Inbox as InboxIcon } from "lucide-react";
import type { Theme } from "@/server/schemas/theme";

type Props = { themes: Theme[] };

/**
 * "What changed since yesterday" strip — Stitch-skin affordance.
 * Computed client-side from the theme list. The 7d sparkline buckets are
 * day-grained with bucket[6] = today (most recent). We surface today's
 * activity as the "since yesterday" delta, and count themes whose severity
 * is high or critical as escalations.
 *
 * Hidden entirely if all three numbers are zero — no fake-news strip.
 */
export const ChangedSinceYesterday = ({ themes }: Props) => {
  let newSignals = 0;
  let newThemes = 0;
  let escalations = 0;

  for (const t of themes) {
    const today = t.signal_buckets_7d.at(-1) ?? 0;
    newSignals += today;
    if (today > 0) newThemes += 1;
    if (t.severity_max === "critical" || t.severity_max === "high") {
      escalations += 1;
    }
  }

  if (newSignals === 0 && newThemes === 0 && escalations === 0) return null;

  return (
    <div
      data-testid="changed-since-yesterday"
      className="mx-6 mt-4 mb-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-border/60 bg-card/80 px-4 py-2.5 backdrop-blur"
    >
      <div className="text-[10px] uppercase tracking-widest font-mono font-semibold text-muted-foreground">
        What changed since yesterday
      </div>
      <span className="h-3 w-px bg-border/60" aria-hidden />
      <Stat
        icon={<InboxIcon size={12} />}
        value={newThemes}
        label={`new theme${newThemes === 1 ? "" : "s"}`}
        accent="ink"
      />
      <Stat
        icon={<ArrowUpRight size={12} />}
        value={newSignals}
        label={`new signal${newSignals === 1 ? "" : "s"}`}
        accent="cta"
      />
      <Stat
        icon={<AlertTriangle size={12} />}
        value={escalations}
        label={`critical escalation${escalations === 1 ? "" : "s"}`}
        accent={escalations > 0 ? "crit" : "ink"}
      />
    </div>
  );
};

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: "ink" | "cta" | "crit";
}) {
  const colour =
    accent === "cta"
      ? "text-[color:var(--cta)]"
      : accent === "crit"
        ? "text-[color:var(--sev-crit)]"
        : "text-foreground";
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs">
      <span className="self-center text-muted-foreground/70">{icon}</span>
      <span className={`font-mono text-base font-bold leading-none ${colour}`}>
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
