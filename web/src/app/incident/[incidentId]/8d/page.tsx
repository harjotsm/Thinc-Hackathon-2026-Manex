import { IncidentEightDScreen } from "@/components/prototype/incident-screens";

export default async function IncidentEightDPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  return <IncidentEightDScreen incidentId={incidentId} />;
}
