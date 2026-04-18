import { runOrchestrator } from "@/server/agent/orchestrator";
import { orchestratorResultSchema } from "@/server/schemas/orchestrator";

const encodeEvent = (event: string, payload: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const incidentId = searchParams.get("incident_id");

  if (!incidentId) {
    return new Response("Missing incident_id", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        controller.enqueue(encoder.encode(encodeEvent("status", { message: "starting" })));
        const result = await runOrchestrator(incidentId);
        const validated = orchestratorResultSchema.safeParse(result);
        if (!validated.success) {
          throw new Error("Invalid orchestrator response shape.");
        }
        for (const phase of result.phases) {
          controller.enqueue(encoder.encode(encodeEvent("phase", phase)));
        }
        controller.enqueue(encoder.encode(encodeEvent("result", validated.data)));
        controller.enqueue(encoder.encode(encodeEvent("done", { ok: true })));
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            encodeEvent("error", {
              message: error instanceof Error ? error.message : "Unknown error",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
