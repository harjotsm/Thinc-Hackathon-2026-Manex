/**
 * Tests for POST /api/intake/voice
 *
 * Runs in vitest node environment. Mocks:
 *  - @/lib/supabase-storage   (uploadVoiceClip)
 *  - @/server/transcription   (transcribeAudio)
 *  - @/lib/supabase-server    (DB insert)
 *  - @/server/correlator/run  (runCorrelator)
 *  - @/server/embeddings      (createEmbedding / vectorLiteral)
 *  - @/server/utils/id        (makeId)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// ── Stable mocks (applied before any import of the route) ─────────────────────

const mockUploadVoiceClip = vi.fn();
const mockEnsureVoiceBucket = vi.fn();
vi.mock("@/lib/supabase-storage", () => ({
  uploadVoiceClip: (...args: unknown[]) => mockUploadVoiceClip(...args),
  ensureVoiceBucket: (...args: unknown[]) => mockEnsureVoiceBucket(...args),
  VOICE_BUCKET: "voice-signals",
}));

const mockTranscribeAudio = vi.fn();
vi.mock("@/server/transcription", () => ({
  transcribeAudio: (...args: unknown[]) => mockTranscribeAudio(...args),
}));

const mockInsertSingle = vi.fn();
const mockInsert = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({
      insert: (...args: unknown[]) => mockInsert(...args),
    }),
  }),
}));

const mockRunCorrelator = vi.fn();
vi.mock("@/server/correlator/run", () => ({
  runCorrelator: (...args: unknown[]) => mockRunCorrelator(...args),
}));

vi.mock("@/server/embeddings", () => ({
  createEmbedding: vi.fn().mockResolvedValue(null),
  vectorLiteral: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/utils/id", () => ({
  makeId: (prefix: string) => `${prefix}-MOCK-001`,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeVoiceForm(overrides: Record<string, string | Blob> = {}): FormData {
  const form = new FormData();
  const defaultBlob = new Blob(["fake-audio"], { type: "audio/webm" });
  form.append("audio", overrides.audio instanceof Blob ? overrides.audio : defaultBlob, "recording.webm");
  form.append("source_system", typeof overrides.source_system === "string" ? overrides.source_system : "voice_floor");
  if (overrides.language) form.append("language", overrides.language as string);
  if (overrides.actor_user_id) form.append("actor_user_id", overrides.actor_user_id as string);
  if (overrides.note) form.append("note", overrides.note as string);
  return form;
}

function makeRequest(form: FormData): Request {
  return new Request("http://localhost/api/intake/voice", {
    method: "POST",
    body: form,
  });
}

const fakeSignalRow = {
  signal_id: "SIG-MOCK-001",
  signal_type: "operator_report",
  source_system: "voice_floor",
  captured_ts: "2026-04-19T10:00:00Z",
  text_payload: "Defect on line 3.",
  attachments: [{ kind: "audio", url: "https://cdn.example.com/clip.webm", transcript: "Defect on line 3.", status: "transcribed" }],
  embedding: null,
  raw_payload: {},
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/intake/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({
      select: () => ({
        single: mockInsertSingle,
      }),
    });
    // Default happy-path stubs
    mockUploadVoiceClip.mockResolvedValue({
      bucket: "voice-signals",
      path: "voice/2026/04/19/uuid-recording.webm",
      publicUrl: "https://cdn.example.com/clip.webm",
    });
    mockTranscribeAudio.mockResolvedValue({
      text: "Defect on line 3.",
      language: "en",
      duration_seconds: 3.1,
      model: "whisper-1",
    });
    mockInsertSingle.mockResolvedValue({ data: fakeSignalRow, error: null });
    mockRunCorrelator.mockResolvedValue({ linkedSignals: 0, incidentIds: [] });
  });

  // ── Validation failures ──────────────────────────────────────────────────────

  it("400 — rejects when no audio field is present", async () => {
    const form = new FormData();
    form.append("source_system", "voice_floor");
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("missing_audio");
    expect(body.retryable).toBe(false);
  });

  it("400 — rejects when source_system is missing", async () => {
    const form = new FormData();
    form.append("audio", new Blob(["data"], { type: "audio/webm" }), "audio.webm");
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("missing_source_system");
    expect(body.retryable).toBe(false);
  });

  it("413 — rejects when file exceeds 25 MB", async () => {
    // Construct a FormData whose "audio" entry has a mocked .size > 25 MB.
    // We spy on Request.prototype.formData to inject it without needing a real upload.
    const MAX = 25 * 1024 * 1024;

    // Build a Blob-like object that looks like a Blob but reports huge size
    const oversizedBlob = new Blob(["x"], { type: "audio/webm" });
    // Vitest runs in Node.js which uses undici; Blob.size is a getter on the prototype.
    // Override it on this specific instance via a simple property redefinition.
    Object.defineProperty(oversizedBlob, "size", {
      get() {
        return MAX + 1;
      },
      configurable: true,
    });

    const oversizedForm = new FormData();
    oversizedForm.append("audio", oversizedBlob, "big.webm");
    oversizedForm.append("source_system", "voice_floor");

    const req = new Request("http://localhost/api/intake/voice", { method: "POST" });
    // Directly replace formData on the instance before handing it to the route
    req.formData = () => Promise.resolve(oversizedForm);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.code).toBe("file_too_large");
    expect(body.retryable).toBe(false);
  });

  // ── Happy path ───────────────────────────────────────────────────────────────

  it("201 — happy path returns signal, correlator, and transcript", async () => {
    const form = makeVoiceForm({ language: "en", actor_user_id: "user_042" });
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);

    // Transcript shape
    expect(body.transcript).toBeDefined();
    expect(body.transcript.text).toBe("Defect on line 3.");
    expect(body.transcript.language).toBe("en");
    expect(body.transcript.duration_seconds).toBe(3.1);

    // Signal shape
    expect(body.signal).toBeDefined();
    expect(body.signal.signal_id).toBe("SIG-MOCK-001");

    // Correlator shape
    expect(body.correlator).toBeDefined();
    expect(body.correlator.linkedSignals).toBe(0);
    expect(Array.isArray(body.correlator.incidentIds)).toBe(true);
    expect(mockRunCorrelator).toHaveBeenCalledOnce();
  });

  it("201 — note is prepended to transcript in text_payload", async () => {
    mockTranscribeAudio.mockResolvedValue({
      text: "Lötpad abgebrochen.",
      language: "de",
      duration_seconds: 2.0,
      model: "whisper-1",
    });
    mockInsertSingle.mockResolvedValue({
      data: { ...fakeSignalRow, text_payload: "Operator note.\n\nLötpad abgebrochen." },
      error: null,
    });

    const form = makeVoiceForm({ note: "Operator note.", language: "de" });
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    // The text_payload passed to the DB insert should include the note
    expect(mockInsertSingle).toHaveBeenCalled();
  });

  it("passes language to transcribeAudio", async () => {
    const form = makeVoiceForm({ language: "de" });
    const req = makeRequest(form);

    const { POST } = await import("../route");
    await POST(req);

    expect(mockTranscribeAudio).toHaveBeenCalledOnce();
    const [, , lang] = mockTranscribeAudio.mock.calls[0];
    expect(lang).toBe("de");
  });

  // ── Upstream failures ────────────────────────────────────────────────────────

  it("502 — returns storage_error when upload fails", async () => {
    mockUploadVoiceClip.mockRejectedValue(new Error("Bucket not found"));

    const form = makeVoiceForm();
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("storage_error");
    expect(body.retryable).toBe(true);
  });

  it("201 — creates fallback signal when Whisper fails but note exists", async () => {
    mockTranscribeAudio.mockRejectedValue(new Error("Whisper API rate limited"));

    mockInsertSingle.mockResolvedValue({
      data: {
        ...fakeSignalRow,
        text_payload: "Operator fallback note.",
        attachments: [{ kind: "audio", url: "https://cdn.example.com/clip.webm", transcript: null, status: "failed" }],
        raw_payload: { transcription_error: { message: "Whisper API rate limited" } },
      },
      error: null,
    });

    const form = makeVoiceForm({ note: "Operator fallback note." });
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledOnce();
    const insertPayload = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertPayload.text_payload).toBe("Operator fallback note.");
    expect(insertPayload.raw_payload).toMatchObject({
      transcription_error: {
        message: "Whisper API rate limited",
      },
    });
    expect(insertPayload.attachments).toEqual([
      expect.objectContaining({
        status: "failed",
        transcript: null,
      }),
    ]);
    expect(mockRunCorrelator).toHaveBeenCalledOnce();
    expect(body.signal).toBeDefined();
  });

  it("502 — returns transcription_error when Whisper fails and no note exists", async () => {
    mockTranscribeAudio.mockRejectedValue(new Error("Whisper API rate limited"));

    const form = makeVoiceForm();
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("transcription_error");
    expect(body.retryable).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockRunCorrelator).not.toHaveBeenCalled();
  });

  it("500 — returns db_error when signal insert fails", async () => {
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: "unique constraint violation" } });

    const form = makeVoiceForm();
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("db_error");
    expect(body.retryable).toBe(true);
  });

  it("201 — correlator failure is non-fatal (signal still returned)", async () => {
    mockRunCorrelator.mockRejectedValue(new Error("correlator exploded"));

    const form = makeVoiceForm();
    const req = makeRequest(form);

    const { POST } = await import("../route");
    const res = await POST(req);
    const body = await res.json();

    // Signal was inserted — should still be 201 with correlator: null
    expect(res.status).toBe(201);
    expect(body.signal).toBeDefined();
    expect(body.correlator).toBeNull();
  });
});
