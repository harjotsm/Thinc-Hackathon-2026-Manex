import { getInitiatives } from "@/server/initiatives/loaders";
import { InitiativesKanban } from "@/components/initiatives/initiatives-kanban";

export const revalidate = 30;

type SearchParams = { [k: string]: string | string[] | undefined };

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const incidentId =
    typeof params.incident === "string" ? params.incident : undefined;

  const initiatives = await getInitiatives({ incidentId });

  return (
    <div style={{ background: "var(--bg, #fafbfc)", minHeight: "100vh" }}>
      <header
        style={{
          padding: "14px 24px",
          borderBottom: "1px solid #f1f5f9",
          background: "white",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}
        >
          Initiatives
        </span>
        <span style={{ color: "#64748b", fontSize: 12 }}>
          {initiatives.length} initiative{initiatives.length === 1 ? "" : "s"}
          {incidentId ? ` for ${incidentId}` : ""}
        </span>
        {incidentId && (
          <a
            href="/initiatives"
            style={{
              fontSize: 11,
              color: "var(--accent, #639fc4)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            &times; clear filter
          </a>
        )}
      </header>
      <InitiativesKanban initiatives={initiatives} />
    </div>
  );
}
