import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import type { IncidentListItem } from "@/server/incidents/loaders";
import { Button } from "@/components/ui/button";

type Props = { incidents: IncidentListItem[] };

const HOURS = 60 * 60 * 1000;

const archetypeOf = (i: IncidentListItem): string =>
  i.report_archetype ?? i.archetype ?? "unknown";

const computeKpis = (incidents: IncidentListItem[]) => {
  const confidences = incidents
    .map((i) => i.confidence)
    .filter((v): v is number => v != null);
  const avgConfidence = confidences.length
    ? Math.round((confidences.reduce((s, v) => s + v, 0) / confidences.length) * 1000) / 10
    : null;

  const ages = incidents
    .map((i) => (i.last_activity_at ? (Date.now() - new Date(i.last_activity_at).getTime()) / HOURS : null))
    .filter((v): v is number => v != null && v >= 0);
  const meanResolutionHours = ages.length
    ? Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10
    : null;

  const activeAlerts = incidents.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  ).length;

  // Supplier-impact narrative: top supplier-archetype product in current view.
  const supplierIncidents = incidents.filter(
    (i) => archetypeOf(i) === "supplier" && i.primary_product_id,
  );
  const productCount = new Map<string, number>();
  for (const i of supplierIncidents) {
    const pid = i.primary_product_id!;
    productCount.set(pid, (productCount.get(pid) ?? 0) + 1);
  }
  let topProduct: string | null = null;
  let topCount = 0;
  for (const [pid, n] of productCount) {
    if (n > topCount) {
      topProduct = pid;
      topCount = n;
    }
  }

  return {
    avgConfidence,
    meanResolutionHours,
    activeAlerts,
    topSupplierProduct: topProduct,
    topSupplierCount: topCount,
  };
};

export const IncidentsKpiBlock = ({ incidents }: Props) => {
  if (incidents.length === 0) return null;

  const kpis = computeKpis(incidents);
  const hasSupplierStory = kpis.topSupplierProduct != null && kpis.topSupplierCount > 1;

  return (
    <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
      {hasSupplierStory ? (
        <div
          data-testid="supplier-impact-card"
          className="md:col-span-1 rounded-xl p-5 text-white relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, var(--cta) 0%, color-mix(in oklab, var(--cta) 70%, black) 100%)",
          }}
        >
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <h3 className="relative text-sm font-bold tracking-tight leading-tight">
            Supplier Impact Analysis
          </h3>
          <p className="relative mt-2 text-xs leading-relaxed text-white/85">
            Batch{" "}
            <span className="font-mono font-bold text-white">
              {kpis.topSupplierProduct}
            </span>{" "}
            has{" "}
            <span className="font-mono font-bold text-white">
              {kpis.topSupplierCount}
            </span>{" "}
            connected incident{kpis.topSupplierCount === 1 ? "" : "s"} in this window.
          </p>
          <Link
            href={`/incidents?archetype=supplier&product=${kpis.topSupplierProduct}`}
            className="relative mt-4 inline-flex"
          >
            <Button
              size="sm"
              className="h-7 bg-white text-[color:var(--cta)] hover:bg-white/90 font-semibold gap-1"
            >
              Launch Investigation
              <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <KpiCard
          testId="kpi-export"
          label="Export"
          value="Report"
          subtitle="PDF + CSV"
          icon={<Download className="size-4" />}
        />
      )}

      <KpiCard
        testId="kpi-avg-confidence"
        label="Avg Confidence"
        value={kpis.avgConfidence != null ? `${kpis.avgConfidence}%` : "—"}
        subtitle={kpis.avgConfidence != null && kpis.avgConfidence >= 70 ? "Healthy" : "Low signal"}
        accent="cta"
      />
      <KpiCard
        testId="kpi-mean-resolution"
        label="Mean Activity Age"
        value={kpis.meanResolutionHours != null ? `${kpis.meanResolutionHours}h` : "—"}
        subtitle="since last update"
      />
      <KpiCard
        testId="kpi-active-alerts"
        label="Active Alerts"
        value={`${kpis.activeAlerts}`}
        subtitle={kpis.activeAlerts > 0 ? "high · critical" : "all clear"}
        accent={kpis.activeAlerts > 0 ? "crit" : undefined}
      />
    </div>
  );
};

function KpiCard({
  testId,
  label,
  value,
  subtitle,
  icon,
  accent,
}: {
  testId: string;
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: "cta" | "crit";
}) {
  const valueClass =
    accent === "cta"
      ? "text-[color:var(--cta)]"
      : accent === "crit"
        ? "text-[color:var(--sev-crit)]"
        : "text-foreground";
  return (
    <div
      data-testid={testId}
      className="rounded-xl bg-card ring-1 ring-border/50 p-5 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 font-bold">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground/60">{icon}</span> : null}
      </div>
      <div
        className={`font-mono text-3xl font-bold leading-none tracking-tight ${valueClass}`}
      >
        {value}
      </div>
      {subtitle ? (
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      ) : null}
    </div>
  );
}
