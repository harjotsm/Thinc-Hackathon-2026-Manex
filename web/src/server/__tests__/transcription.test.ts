import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so the import guard doesn't throw in vitest
vi.mock("server-only", () => ({}));

// Mock the OpenAI client singleton
const mockCreate = vi.fn();
const mockGetOpenAIClient = vi.fn(() => ({
  audio: {
    transcriptions: {
      create: mockCreate,
    },
  },
}));
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: mockGetOpenAIClient,
}));

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns expected shape for a Buffer input", async () => {
    mockCreate.mockResolvedValue({
      text: "Fehler an Lötpad R33 festgestellt.",
      language: "de",
      duration: 4.2,
    });

    const { transcribeAudio } = await import("../transcription");
    const buf = Buffer.from("fake-audio-data");
    const result = await transcribeAudio(buf, "recording.webm", "de");

    expect(result).toEqual({
      text: "Fehler an Lötpad R33 festgestellt.",
      language: "de",
      duration_seconds: 4.2,
      model: "whisper-1",
    });
  });

  it("returns expected shape for a Blob input", async () => {
    mockCreate.mockResolvedValue({
      text: "Defect detected on batch SB-00007.",
      language: "en",
      duration: 2.8,
    });

    const { transcribeAudio } = await import("../transcription");
    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const result = await transcribeAudio(blob, "clip.webm");

    expect(result.text).toBe("Defect detected on batch SB-00007.");
    expect(result.language).toBe("en");
    expect(result.duration_seconds).toBe(2.8);
    expect(result.model).toBe("whisper-1");
  });

  it("forwards Blob MIME type to OpenAI file payload", async () => {
    mockCreate.mockResolvedValue({ text: "ok", language: "en", duration: 1.0 });

    const { transcribeAudio } = await import("../transcription");
    const blob = new Blob(["fake-audio"], { type: "audio/ogg" });
    await transcribeAudio(blob, "clip.ogg");

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];
    const sentFile = callArg.file as File;
    expect(sentFile.name).toBe("clip.ogg");
    expect(sentFile.type).toBe("audio/ogg");
  });

  it("derives MIME type from filename when Blob type is missing", async () => {
    mockCreate.mockResolvedValue({ text: "ok", language: "en", duration: 1.0 });

    const { transcribeAudio } = await import("../transcription");
    const blob = new Blob(["fake-audio"]);
    await transcribeAudio(blob, "clip.wav");

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];
    const sentFile = callArg.file as File;
    expect(sentFile.type).toBe("audio/wav");
  });

  it("passes language parameter through to OpenAI when provided", async () => {
    mockCreate.mockResolvedValue({ text: "Prüfung abgeschlossen.", language: "de", duration: 1.0 });

    const { transcribeAudio } = await import("../transcription");
    await transcribeAudio(Buffer.from("data"), "test.webm", "de");

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.language).toBe("de");
    expect(callArg.model).toBe("whisper-1");
    expect(callArg.response_format).toBe("verbose_json");
    expect(callArg.temperature).toBe(0);
  });

  it("handles null/undefined duration gracefully", async () => {
    mockCreate.mockResolvedValue({ text: "Short clip.", language: "en" });

    const { transcribeAudio } = await import("../transcription");
    const result = await transcribeAudio(Buffer.from("x"), "short.webm");

    expect(result.duration_seconds).toBeNull();
    expect(result.text).toBe("Short clip.");
  });

  it("uses a configured OpenAI client", async () => {
    mockCreate.mockResolvedValue({ text: "Configured client.", language: "en", duration: 1.2 });

    const { transcribeAudio } = await import("../transcription");
    await transcribeAudio(Buffer.from("x"), "clip.webm");

    expect(mockGetOpenAIClient).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe("env", () => {
  it("does not require OPENAI_API_KEY when loading env", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();

    try {
      const { env } = await import("@/lib/env?fresh=" + Date.now());
      expect(env.openAiApiKey).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });

  it("requires OPENAI_API_KEY in server-only OpenAI client path", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    vi.resetModules();

    try {
      await expect(import("@/lib/openai?fresh=" + Date.now())).rejects.toThrow(
        /Missing environment variable: OPENAI_API_KEY/,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });
});
