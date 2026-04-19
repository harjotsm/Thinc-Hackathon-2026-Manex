import Link from "next/link";
import { X } from "lucide-react";
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
    <div className="min-h-screen">
      <header className="bg-card border-b border-border">
        <div className="px-6 py-4 flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Initiatives
          </h1>
          <p className="text-xs text-muted-foreground">
            {initiatives.length} initiative{initiatives.length === 1 ? "" : "s"}
            {incidentId ? ` for ${incidentId}` : ""}
          </p>
          {incidentId && (
            <Link
              href="/initiatives"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <X className="size-3" />
              Clear filter
            </Link>
          )}
        </div>
      </header>
      <InitiativesKanban initiatives={initiatives} />
    </div>
  );
}
