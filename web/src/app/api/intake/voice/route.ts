import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { uploadVoiceClip } from "@/lib/supabase-storage";
import { transcribeAudio } from "@/server/transcription";
import { createEmbedding, vectorLiteral } from "@/server/embeddings";
import { runCorrelator } from "@/server/correlator/run";
import { makeId } from "@/server/utils/id";
import { signalRowSchema } from "@/server/schemas/signal";

// 25 MB — OpenAI Whisper hard limit
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

type ErrorBody = {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
};

const err = (code: string, message: string, retryable: boolean, status: number, details?: unknown) =>
  NextResponse.json<ErrorBody>({ code, message, retryable, ...(details !== undefined ? { details } : {}) }, { status });

export async function POST(request: Request) {
  // Parse multipart/form-data
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err("parse_error", "Could not parse multipart form data.", false, 400);
  }

  const audioEntry = form.get("audio");
  if (!audioEntry || !(audioEntry instanceof Blob)) {
    return err("missing_audio", "Field 'audio' (file) is required.", false, 400);
  }

  const sourceSystem = form.get("source_system");
  if (!sourceSystem || typeof sourceSystem !== "string" || !sourceSystem.trim()) {
    return err("missing_source_system", "Field 'source_system' (string) is required.", false, 400);
  }

  const actorUserId = form.get("actor_user_id");
  const languageField = form.get("language");
  const noteField = form.get("note");
  const language = typeof languageField === "string" && languageField.trim() ? languageField.trim() : undefined;
  const note = typeof noteField === "string" && noteField.trim() ? noteField.trim() : undefined;

  // Validate file size
  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return err(
      "file_too_large",
      `Audio file exceeds the 25 MB Whisper limit (received ${audioEntry.size} bytes).`,
      false,
      413,
    );
  }

  // Derive a filename hint from the Blob or use a sensible default
  const filenameHint =
    (audioEntry as unknown as { name?: string }).name ||
    `audio-${Date.now()}.${audioEntry.type?.split("/")[1] ?? "webm"}`;
  const contentType = audioEntry.type || "audio/webm";

  // 1. Upload to Supabase Storage
  let storedRef: Awaited<ReturnType<typeof uploadVoiceClip>>;
  try {
    storedRef = await uploadVoiceClip(audioEntry, filenameHint, contentType);
  } catch (uploadErr) {
    const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
    return err("storage_error", `Failed to store audio: ${msg}`, true, 502);
  }

  // 2. Transcribe via Whisper
  let transcription: Awaited<ReturnType<typeof transcribeAudio>>;
  try {
    transcription = await transcribeAudio(audioEntry, filenameHint, language);
  } catch (transcribeErr) {
    const msg = transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr);
    return err("transcription_error", `Whisper transcription failed: ${msg}`, true, 502);
  }

  // 3. Compose signal text: optional operator note + transcript
  const textParts: string[] = [];
  if (note) textParts.push(note);
  textParts.push(transcription.text);
  const textPayload = textParts.join("\n\n");

  if (!textPayload.trim()) {
    return err("empty_transcript", "Transcription produced no text and no note was provided.", false, 422);
  }

  // 4. Embed
  const embedding = await createEmbedding(textPayload);

  // 5. Insert signal row
  const signalId = makeId("SIG");
  const idempotencyKey = (form.get("idempotency_key") as string | null) ?? `auto-${crypto.randomUUID()}`;
  const supabase = getSupabaseServerClient();

  const attachmentUrl = storedRef.publicUrl ?? `${storedRef.bucket}/${storedRef.path}`;

  const insertPayload = {
    signal_id: signalId,
    idempotency_key: idempotencyKey,
    signal_type: "operator_report",
    source: "operator",
    raw_text: textPayload,
    source_system: sourceSystem.trim(),
    captured_ts: new Date().toISOString(),
    text_payload: textPayload,
    raw_payload: {
      source: "voice_intake",
      storage_path: storedRef.path,
      storage_bucket: storedRef.bucket,
      content_type: contentType,
      filename: filenameHint,
      note: note ?? null,
      transcription_language: transcription.language,
      transcription_duration_seconds: transcription.duration_seconds,
    },
    attachments: [
      {
        kind: "audio",
        url: attachmentUrl,
        transcript: transcription.text,
        status: "transcribed",
      },
    ],
    embedding: vectorLiteral(embedding),
    created_by_user_id: typeof actorUserId === "string" && actorUserId.trim() ? actorUserId.trim() : null,
    severity_hint: 0.5,
  };

  const { data: signal, error: insertError } = await supabase
    .from("signal")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertError) {
    return err("db_error", insertError.message, true, 500);
  }

  // Validate the returned row against the schema before running correlator
  const rowParsed = signalRowSchema.safeParse(signal);
  if (!rowParsed.success) {
    // Row is in DB but shape is unexpected — log and continue
    console.warn("[voice intake] signal row shape unexpected:", rowParsed.error.flatten());
  }

  // 6. Run correlator
  let correlatorResult: Awaited<ReturnType<typeof runCorrelator>> | null = null;
  try {
    correlatorResult = await runCorrelator();
  } catch (correlatorErr) {
    // Non-fatal — the signal is already inserted; correlator can be re-run
    console.error("[voice intake] correlator failed:", correlatorErr);
  }

  return NextResponse.json(
    {
      signal: rowParsed.success ? rowParsed.data : signal,
      correlator: correlatorResult,
      transcript: {
        text: transcription.text,
        language: transcription.language,
        duration_seconds: transcription.duration_seconds,
      },
    },
    { status: 201 },
  );
}
