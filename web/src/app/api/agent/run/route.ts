import { NextResponse } from "next/server";
import { z } from "zod";
import { runOrchestrator } from "@/server/agent/orchestrator";

const payloadSchema = z.object({
  incident_id: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await runOrchestrator(parsed.data.incident_id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error while running orchestrator." },
      { status: 500 },
    );
  }
}
