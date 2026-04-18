import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { initiativeCreateSchema } from "@/server/schemas/initiative";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { makeId } from "@/server/utils/id";

const makeProductActionId = () => {
  const numeric = randomInt(0, 100000).toString().padStart(5, "0");
  return `PA-${numeric}`;
};

const approveResultSchema = z.object({
  initiative: z.record(z.string(), z.unknown()),
  product_action_id: z.string(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = initiativeCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const supabase = getSupabaseServerClient();

  const initiativeId = makeId("INIT");
  const actionId = makeProductActionId();

  if (!payload.product_id) {
    return NextResponse.json(
      { error: "product_id is required to write product_action." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .rpc("resolve_approve_initiative", {
      _initiative_id: initiativeId,
      _incident_id: payload.incident_id,
      _agent_domain: payload.agent_domain,
      _target_system: payload.target_system,
      _owner_user_id: payload.owner_user_id ?? null,
      _due_ts: payload.due_ts ?? null,
      _status: payload.status ?? "approved",
      _closure_predicate: payload.closure_predicate,
      _product_id: payload.product_id,
      _defect_id: payload.defect_id ?? null,
      _section_id: payload.section_id ?? null,
      _comments: payload.comments ?? `Initiative generated from ${payload.incident_id}`,
      _action_id: actionId,
    })
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to approve initiative." }, { status: 500 });
  }

  const parsedResult = approveResultSchema.safeParse(data);
  if (!parsedResult.success) {
    return NextResponse.json({ error: "Invalid response from resolve_approve_initiative." }, { status: 500 });
  }

  return NextResponse.json({
    initiative: parsedResult.data.initiative,
    product_action_id: parsedResult.data.product_action_id,
  });
}
