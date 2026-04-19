import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so the import guard doesn't throw in vitest
vi.mock("server-only", () => ({}));

// Mock the OpenAI client singleton
const mockCreate = vi.fn();
vi.mock("@/lib/openai", () => ({
  getOpenAIClient: () => ({
    audio: {
      transcriptions: {
        create: mockCreate,
      },
    },
  }),
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

  it("throws when OpenAI client is not configured", async () => {
    vi.doMock("@/lib/openai", () => ({
      getOpenAIClient: () => null,
    }));

    // Reset module cache so the mock takes effect
    const { transcribeAudio: fresh } = await import("../transcription?fresh=" + Date.now());
    await expect(fresh(Buffer.from("x"), "clip.webm")).rejects.toThrow(
      /OpenAI client is not configured/,
    );
  });
});
