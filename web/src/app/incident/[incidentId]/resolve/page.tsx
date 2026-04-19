import { IncidentResolveScreen } from "@/components/prototype/incident-screens";

export default async function IncidentResolvePage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  return <IncidentResolveScreen incidentId={incidentId} />;
}
