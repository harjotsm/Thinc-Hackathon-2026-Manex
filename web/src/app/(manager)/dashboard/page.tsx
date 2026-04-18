import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ManagerDashboardPage() {
  const supabase = getSupabaseServerClient();

  const [{ data: incidents }, { data: initiatives }, { data: quality }] = await Promise.all([
    supabase
      .from("incident")
      .select("incident_id,title,status,severity,opened_ts")
      .order("opened_ts", { ascending: false })
      .limit(20),
    supabase
      .from("initiative")
      .select("initiative_id,incident_id,agent_domain,status,due_ts")
      .order("created_ts", { ascending: false })
      .limit(20),
    supabase
      .from("v_quality_summary")
      .select("article_name,week_start,defect_count,claim_count")
      .order("week_start", { ascending: false })
      .limit(10),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Leadership Lens — Dashboard</h1>

      <section className="rounded border border-zinc-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Open incidents</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="py-2 pr-4">Incident</th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(incidents ?? []).map((incident) => (
                <tr key={incident.incident_id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4">
                    <Link
                      className="text-blue-700 underline"
                      href={`/investigate/${incident.incident_id}`}
                    >
                      {incident.title ?? incident.incident_id}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{incident.severity ?? "-"}</td>
                  <td className="py-2 pr-4">{incident.status}</td>
                </tr>
              ))}
              {(incidents ?? []).length === 0 ? (
                <tr>
                  <td className="py-3 text-zinc-500" colSpan={3}>
                    No incidents yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-zinc-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Initiatives</h2>
        <ul className="space-y-2 text-sm">
          {(initiatives ?? []).map((initiative) => (
            <li key={initiative.initiative_id} className="rounded bg-zinc-50 p-2">
              <p className="font-medium">
                {initiative.initiative_id} · {initiative.agent_domain}
              </p>
              <p className="text-zinc-600">
                Incident {initiative.incident_id} · Status {initiative.status}
              </p>
            </li>
          ))}
          {(initiatives ?? []).length === 0 ? <li className="text-zinc-500">No initiatives yet.</li> : null}
        </ul>
      </section>

      <section className="rounded border border-zinc-200 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Weekly quality pulse</h2>
        <ul className="space-y-2 text-sm">
          {(quality ?? []).map((row) => (
            <li key={`${row.article_name}-${row.week_start}`} className="rounded bg-zinc-50 p-2">
              {row.week_start}: {row.article_name} · defects {row.defect_count} · claims {row.claim_count}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
