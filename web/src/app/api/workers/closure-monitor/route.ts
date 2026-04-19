import { NextResponse } from "next/server";
import { runClosureMonitor } from "@/server/workers/closure-monitor";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
    }
  }

  try {
    const result = await runClosureMonitor();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected closure monitor error." },
      { status: 500 },
    );
  }
}
