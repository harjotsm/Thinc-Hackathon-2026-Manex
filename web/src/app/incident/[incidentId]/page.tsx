import { IncidentCanvasScreen } from "@/components/prototype/incident-screens";

export default async function IncidentCanvasPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  return <IncidentCanvasScreen incidentId={incidentId} />;
}
