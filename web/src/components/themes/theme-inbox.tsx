import type { Theme } from "@/server/schemas/theme";
import { ThemeCard } from "./theme-card";

type Props = { themes: Theme[] };

/**
 * Inbox surface for cluster themes. Now a server-friendly stateless wrapper:
 * the redesigned ThemeCard is rich enough that the per-row expand/collapse
 * toggle and demo-only multi-select merge banner have been retired.
 */
export const ThemeInbox = ({ themes }: Props) => {
  return (
    <div className="px-6 py-5">
      <div className="flex flex-col gap-2">
        {themes.map((t) => (
          <ThemeCard key={t.signature} theme={t} />
        ))}
      </div>
    </div>
  );
};
