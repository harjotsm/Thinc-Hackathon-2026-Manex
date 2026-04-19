import { headers } from "next/headers";
import { Inbox as InboxIcon } from "lucide-react";
import { themesResponseSchema } from "@/server/schemas/theme";
import { FilterStrip } from "@/components/themes/filter-strip";
import { ThemeInbox } from "@/components/themes/theme-inbox";

export const revalidate = 30;

type SearchParams = { [k: string]: string | string[] | undefined };

const fetchThemes = async (params: SearchParams) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.length > 0) qs.set(k, v);
  }
  if (!qs.has("lens")) qs.set("lens", "engineer");
  if (!qs.has("window")) qs.set("window", "7d");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/themes?${qs.toString()}`;

  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Failed to load themes: ${res.status}`);
  return themesResponseSchema.parse(await res.json());
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await fetchThemes(params);

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b border-border">
        <div className="px-6 py-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Inbox
          </h1>
          <p className="text-xs text-muted-foreground">
            {data.themes.length} theme{data.themes.length === 1 ? "" : "s"} ·
            window {data.window_days}d · last sync{" "}
            {new Date(data.generated_at).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </header>
      <FilterStrip />
      {data.themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <InboxIcon size={20} />
          </div>
          <p className="text-sm font-medium text-foreground">All clear</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No open themes in the last {data.window_days} days.
          </p>
        </div>
      ) : (
        <ThemeInbox themes={data.themes} />
      )}
    </div>
  );
}
