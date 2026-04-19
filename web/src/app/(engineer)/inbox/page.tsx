import { headers } from "next/headers";
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
    <div style={{ background: "var(--bg, #fafbfc)", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 24px",
          borderBottom: "1px solid #f1f5f9",
          background: "white",
        }}
      >
        <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>Inbox</span>
        <span style={{ color: "#64748b", fontSize: 12 }}>
          {data.themes.length} themes · window {data.window_days}d · last sync{" "}
          {new Date(data.generated_at).toLocaleTimeString()}
        </span>
        <div
          style={{
            flex: 1,
            maxWidth: 380,
            margin: "0 auto",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          ⌘K Search themes, incidents, lessons…
        </div>
      </header>
      <FilterStrip />
      {data.themes.length === 0 ? (
        <div
          style={{
            margin: "60px auto",
            maxWidth: 360,
            textAlign: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          All clear — no open themes in the last {data.window_days}d.
        </div>
      ) : (
        <ThemeInbox themes={data.themes} />
      )}
    </div>
  );
}
