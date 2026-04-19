import "server-only";
import { getOpenAIClient } from "@/lib/openai";

export type TranscriptionResult = {
  text: string;
  language: string | null;
  duration_seconds: number | null;
  model: string;
};

const mimeTypeFromFilename = (filenameHint: string): string | null => {
  const extension = filenameHint.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "mp4":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    case "webm":
      return "audio/webm";
    default:
      return null;
  }
};

export const transcribeAudio = async (
  audio: Buffer | Blob,
  filenameHint: string,
  language?: string,
): Promise<TranscriptionResult> => {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OpenAI client is not configured (missing OPENAI_API_KEY).");
  }

  // OpenAI SDK accepts a Web File-like object with a name and type.
  let file: File;
  if (audio instanceof Buffer) {
    file = new File([new Uint8Array(audio)], filenameHint, {
      type: mimeTypeFromFilename(filenameHint) ?? "application/octet-stream",
    });
  } else if (audio instanceof Blob && !(audio as unknown as { name?: string }).name) {
    file = new File([audio], filenameHint, {
      type: (audio as Blob).type || mimeTypeFromFilename(filenameHint) || "application/octet-stream",
    });
  } else {
    file = audio as unknown as File;
  }

  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language,
    response_format: "verbose_json",
    temperature: 0,
  });

  // verbose_json returns { text, language, duration }
  return {
    text: (result as unknown as { text?: string }).text ?? "",
    language: (result as unknown as { language?: string | null }).language ?? null,
    duration_seconds:
      typeof (result as unknown as { duration?: unknown }).duration === "number"
        ? ((result as unknown as { duration: number }).duration)
        : null,
    model: "whisper-1",
  };
};
