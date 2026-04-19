import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

type VoiceIntakeResponse = {
  signal?: { signal_id?: string };
  transcript?: { text?: string };
};

type AgentRunResponse = {
  incident_id?: string;
  tool_calls?: Array<{ tool_call_id: string; data?: unknown }>;
};

type ReportResponse = {
  incident_id?: string;
  draft_8d?: Record<string, unknown>;
  tool_calls?: Array<{ tool_call_id: string; data?: unknown }>;
};

const loadEnvLocal = () => {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "../../../../../..", ".env.local"),
  ];

  const envPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!envPath) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const idx = trimmed.indexOf("=");
    if (idx === -1) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var for smoke test: ${name}`);
  }
  return value;
};

const resolveAudioPath = (inputPath: string): string =>
  path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);

const mimeFromPath = (audioPath: string): string => {
  const ext = path.extname(audioPath).toLowerCase();
  switch (ext) {
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "audio/webm";
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
};

const collectStrings = (value: unknown, out: string[]): void => {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectStrings(nested, out);
    }
  }
};

const collectEvidenceIds = (draft: Record<string, unknown>): string[] => {
  const ids: string[] = [];

  const draftEvidence = draft.evidence;
  if (Array.isArray(draftEvidence)) {
    for (const entry of draftEvidence) {
      if (typeof entry === "string" && entry.trim()) {
        ids.push(entry);
      }
    }
  }

  const claims = draft.claims;
  if (Array.isArray(claims)) {
    for (const claim of claims) {
      if (!claim || typeof claim !== "object") {
        continue;
      }
      const claimEvidence = (claim as Record<string, unknown>).evidence;
      if (!Array.isArray(claimEvidence)) {
        continue;
      }
      for (const entry of claimEvidence) {
        if (typeof entry === "string" && entry.trim()) {
          ids.push(entry);
        }
      }
    }
  }

  return ids;
};

loadEnvLocal();

describe("POST /api/intake/voice (live smoke)", () => {
  it(
    "processes live audio through intake, linkage, orchestrator, and report evidence trail",
    async () => {
      const audioPath = resolveAudioPath(requireEnv("VOICE_SMOKE_AUDIO_PATH"));
      expect(fs.existsSync(audioPath)).toBe(true);

      const [
        { POST: voiceIntakePost },
        { POST: runAgentPost },
        { GET: incidentSignalsGet },
        { GET: incidentReportGet },
        { getSupabaseServerClient },
      ] = await Promise.all([
        import("../route"),
        import("@/app/api/agent/run/route"),
        import("@/app/api/incident/[incidentId]/signals/route"),
        import("@/app/api/incident/[incidentId]/report/route"),
        import("@/lib/supabase-server"),
      ]);

      const audioBuffer = fs.readFileSync(audioPath);
      const audioFilename = path.basename(audioPath);
      const audioBlob = new Blob([audioBuffer], { type: mimeFromPath(audioFilename) });

      const sourceSystem = `voice_smoke_${Date.now()}`;
      const noteMarker = `voice smoke marker ${Date.now()} alpha delta`;
      const idempotencyKey = `voice-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const form = new FormData();
      form.append("audio", audioBlob, audioFilename);
      form.append("source_system", sourceSystem);
      form.append("note", noteMarker);
      form.append("idempotency_key", idempotencyKey);

      const intakeReq = new Request("http://localhost/api/intake/voice", {
        method: "POST",
        body: form,
      });

      const intakeRes = await voiceIntakePost(intakeReq);
      const intakeBody = (await intakeRes.json()) as VoiceIntakeResponse;

      expect(intakeRes.status).toBe(201);
      const primarySignalId = intakeBody.signal?.signal_id;
      expect(typeof primarySignalId).toBe("string");
      expect(primarySignalId).toBeTruthy();

      const transcriptText = (intakeBody.transcript?.text ?? "").trim();
      expect(transcriptText.length).toBeGreaterThan(0);

      const supabase = getSupabaseServerClient();

      const { data: persistedSignals, error: persistedSignalError } = await supabase
        .from("signal")
        .select("signal_id,text_payload,attachments")
        .eq("signal_id", primarySignalId)
        .limit(1);

      if (persistedSignalError) {
        throw new Error(`signal read failed: ${persistedSignalError.message}`);
      }

      const persistedSignal = (persistedSignals ?? [])[0] as
        | { text_payload?: string | null; attachments?: unknown }
        | undefined;

      expect(persistedSignal).toBeDefined();
      expect((persistedSignal?.text_payload ?? "").toLowerCase()).toContain(noteMarker.toLowerCase());

      const attachmentBlob = JSON.stringify(persistedSignal?.attachments ?? []).toLowerCase();
      expect(attachmentBlob.includes("transcript")).toBe(true);

      const findIncidentIdForSignal = async (signalId: string): Promise<string | null> => {
        const { data, error } = await supabase
          .from("incident_signal")
          .select("incident_id")
          .eq("signal_id", signalId)
          .limit(1);

        if (error) {
          throw new Error(`incident_signal read failed: ${error.message}`);
        }

        const row = (data ?? [])[0] as { incident_id?: string } | undefined;
        return row?.incident_id ?? null;
      };

      const waitForIncidentLink = async (signalId: string, timeoutMs: number): Promise<string | null> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const incidentId = await findIncidentIdForSignal(signalId);
          if (incidentId) {
            return incidentId;
          }
          await sleep(2500);
        }
        return null;
      };

      let incidentId = await waitForIncidentLink(primarySignalId as string, 30_000);

      if (!incidentId) {
        const bridgeForm = new FormData();
        bridgeForm.append("audio", audioBlob, audioFilename);
        bridgeForm.append("source_system", sourceSystem);
        bridgeForm.append("note", `voice smoke bridge ${Date.now()}`);
        bridgeForm.append("idempotency_key", `${idempotencyKey}-bridge`);

        const bridgeReq = new Request("http://localhost/api/intake/voice", {
          method: "POST",
          body: bridgeForm,
        });

        const bridgeRes = await voiceIntakePost(bridgeReq);
        expect(bridgeRes.status).toBe(201);

        incidentId = await waitForIncidentLink(primarySignalId as string, 90_000);
      }

      expect(incidentId).toBeTruthy();

      const linkedSignalsRes = await incidentSignalsGet(
        new Request(`http://localhost/api/incident/${incidentId}/signals`),
        { params: Promise.resolve({ incidentId: incidentId as string }) },
      );
      expect(linkedSignalsRes.status).toBe(200);

      const linkedSignalsBody = (await linkedSignalsRes.json()) as {
        signals?: Array<{ signal_id?: string; text_payload?: string | null }>;
      };

      const linkedPrimary = (linkedSignalsBody.signals ?? []).find(
        (signal) => signal.signal_id === primarySignalId,
      );
      expect(linkedPrimary).toBeDefined();

      let orchestratorBody: AgentRunResponse | null = null;
      let orchestratorStatus = 0;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const runReq = new Request("http://localhost/api/agent/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ incident_id: incidentId }),
        });

        const runRes = await runAgentPost(runReq);
        orchestratorStatus = runRes.status;
        const body = (await runRes.json()) as AgentRunResponse;

        if (runRes.status === 200) {
          orchestratorBody = body;
          break;
        }

        if (attempt < 2) {
          await sleep(3000);
        }
      }

      expect(orchestratorStatus).toBe(200);
      expect(orchestratorBody?.incident_id).toBe(incidentId);

      let reportBody: ReportResponse | null = null;
      const reportStart = Date.now();
      while (Date.now() - reportStart < 120_000) {
        const reportRes = await incidentReportGet(
          new Request(`http://localhost/api/incident/${incidentId}/report`),
          { params: Promise.resolve({ incidentId: incidentId as string }) },
        );

        if (reportRes.status === 404) {
          await sleep(3000);
          continue;
        }

        expect(reportRes.status).toBe(200);
        reportBody = (await reportRes.json()) as ReportResponse;
        break;
      }

      expect(reportBody).not.toBeNull();
      expect(reportBody?.incident_id).toBe(incidentId);

      const draft8d = (reportBody?.draft_8d ?? {}) as Record<string, unknown>;
      const toolCalls = reportBody?.tool_calls ?? [];
      expect(Array.isArray(toolCalls)).toBe(true);

      const citedEvidenceIds = collectEvidenceIds(draft8d);
      expect(citedEvidenceIds.length).toBeGreaterThan(0);

      const citedSet = new Set(citedEvidenceIds);
      const citedCalls = toolCalls.filter((toolCall) => citedSet.has(toolCall.tool_call_id));
      expect(citedCalls.length).toBeGreaterThan(0);

      const reportStrings: string[] = [];
      collectStrings(draft8d, reportStrings);

      const reportText = reportStrings.join("\n").toLowerCase();
      const citedBlob = JSON.stringify(citedCalls).toLowerCase();
      const transcriptNeedle = transcriptText.toLowerCase().slice(0, 24);
      const markerNeedle = noteMarker.toLowerCase();

      const evidenceReferencesInput =
        reportText.includes(markerNeedle) ||
        (transcriptNeedle.length >= 10 && reportText.includes(transcriptNeedle)) ||
        citedBlob.includes(markerNeedle) ||
        (transcriptNeedle.length >= 10 && citedBlob.includes(transcriptNeedle)) ||
        citedBlob.includes((primarySignalId as string).toLowerCase());

      expect(evidenceReferencesInput).toBe(true);
    },
    300_000,
  );
});
