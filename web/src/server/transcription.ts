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
    case "flac":
      return "audio/flac";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "mp3":
    case "mpga":
    case "mpeg":
      return "audio/mpeg";
    case "oga":
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

const extensionFromMimeType = (mimeType: string | null): string | null => {
  if (!mimeType) return null;
  switch (mimeType) {
    case "audio/flac":
      return "flac";
    case "audio/mp4":
      return "mp4";
    case "audio/mpeg":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
      return "wav";
    case "audio/webm":
      return "webm";
    default:
      return null;
  }
};

const normalizeMimeType = (rawMimeType: string | null | undefined): string | null => {
  if (!rawMimeType) return null;
  const base = rawMimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return base || null;
};

const sniffAudioExtension = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 12) {
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
    ) {
      return "wav";
    }
  }
  if (bytes.length >= 4) {
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) return "flac";
  }
  if (bytes.length >= 3) {
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";
  }
  if (bytes.length >= 8) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "mp4";
  }
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  }
  return null;
};

const withExtension = (filename: string, extension: string): string => {
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  return `${base || "audio"}.${extension}`;
};

const normalizeFilenameForWhisper = (filenameHint: string): string => {
  const trimmed = filenameHint.trim();
  const fallback = trimmed || "audio.webm";
  const extension = fallback.split(".").pop()?.toLowerCase() ?? "";
  if (mimeTypeFromFilename(fallback)) {
    return fallback;
  }
  const dotIndex = fallback.lastIndexOf(".");
  const baseName = dotIndex > 0 ? fallback.slice(0, dotIndex) : fallback;
  return `${baseName || "audio"}.webm`;
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
  const normalizedFilename = normalizeFilenameForWhisper(filenameHint);
  const normalizedFilenameMime = normalizeMimeType(mimeTypeFromFilename(normalizedFilename));
  let file: File;
  if (audio instanceof Buffer) {
    const bytes = new Uint8Array(audio);
    const sniffedExtension = sniffAudioExtension(bytes);
    const chosenExtension =
      sniffedExtension ??
      extensionFromMimeType(normalizedFilenameMime) ??
      "webm";
    const finalFilename = withExtension(normalizedFilename, chosenExtension);
    const finalMimeType = normalizeMimeType(mimeTypeFromFilename(finalFilename)) ?? "audio/webm";
    file = new File([bytes], finalFilename, {
      type: finalMimeType,
    });
  } else {
    const blob = audio as Blob;
    const sniffedBytes = new Uint8Array(await blob.slice(0, 64).arrayBuffer());
    const sniffedExtension = sniffAudioExtension(sniffedBytes);
    const normalizedBlobMimeType = normalizeMimeType(blob.type);
    const extensionFromBlobMimeType = extensionFromMimeType(normalizedBlobMimeType);
    const chosenExtension =
      sniffedExtension ??
      extensionFromBlobMimeType ??
      extensionFromMimeType(normalizedFilenameMime) ??
      "webm";
    const finalFilename = withExtension(normalizedFilename, chosenExtension);
    const finalMimeType = normalizeMimeType(mimeTypeFromFilename(finalFilename)) ?? "audio/webm";
    file = new File([blob], finalFilename, {
      type: finalMimeType,
    });
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
