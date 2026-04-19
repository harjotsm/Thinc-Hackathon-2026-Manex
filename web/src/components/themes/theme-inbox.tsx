import type { Theme } from "@/server/schemas/theme";
import { ThemeCard } from "./theme-card";

type Props = { themes: Theme[] };

const isUntriaged = (t: Theme): boolean =>
  !t.archetype || t.archetype === "unknown";

/**
 * Inbox surface for cluster themes. Triaged clusters (a concrete archetype
 * was identified) come first — untriaged ones sink beneath a subtle divider
 * so the top of the inbox reads as "things we already understand".
 */
export const ThemeInbox = ({ themes }: Props) => {
  const triaged = themes.filter((t) => !isUntriaged(t));
  const untriaged = themes.filter(isUntriaged);

  return (
    <div className="px-6 py-5">
      <div className="flex flex-col gap-2">
        {triaged.map((t) => (
          <ThemeCard key={t.signature} theme={t} />
        ))}

        {triaged.length > 0 && untriaged.length > 0 ? (
          <div className="mt-4 mb-1 flex items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span>Needs triage</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground/70 normal-case tracking-normal font-medium">
              {untriaged.length} cluster{untriaged.length === 1 ? "" : "s"} awaiting archetype
            </span>
            <span className="flex-1 h-px bg-border/60 ml-2" />
          </div>
        ) : null}

        {untriaged.map((t) => (
          <ThemeCard key={t.signature} theme={t} />
        ))}
      </div>
    </div>
  );
};
