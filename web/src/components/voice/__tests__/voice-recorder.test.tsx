// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { VoiceRecorder } from "../voice-recorder";

// --- MediaRecorder stub ---
let mockRecorderMimeType = "audio/webm";
let supportedRecorderMimeTypes: Set<string> | null = null;

class MockMediaRecorder {
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = mockRecorderMimeType;
  stream: MediaStream;
  opts?: MediaRecorderOptions;
  constructor(stream: MediaStream, opts?: MediaRecorderOptions) {
    this.stream = stream;
    this.opts = opts;
    if (opts?.mimeType && !MockMediaRecorder.isTypeSupported(opts.mimeType)) {
      throw new DOMException("The string did not match the expected pattern.");
    }
    if (opts?.mimeType) {
      this.mimeType = opts.mimeType;
    }
  }
  start(_timeslice?: number) { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["fake"], { type: this.mimeType }) });
      this.onstop?.();
    }, 0);
  }
  static isTypeSupported(mime: string) {
    if (!supportedRecorderMimeTypes) return true;
    return supportedRecorderMimeTypes.has(mime);
  }
}
(globalThis as unknown as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

Object.defineProperty(navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
  },
  configurable: true,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  mockRecorderMimeType = "audio/webm";
  supportedRecorderMimeTypes = null;
  // Reset the getUserMedia mock to default success before each test
  (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });
});

describe("VoiceRecorder", () => {
  it("renders idle button by default", () => {
    render(<VoiceRecorder />);
    const el = screen.getByTestId("voice-recorder");
    expect(el).toBeTruthy();
    expect(screen.getByText(/Voice note/)).toBeTruthy();
  });

  it("clicking Voice note sets state to recording and shows stop button", async () => {
    render(<VoiceRecorder />);
    const btn = screen.getByText(/Voice note/);
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => expect(screen.queryByText(/Stop/)).toBeTruthy());
  });

  it("falls back to default MediaRecorder options when no preferred mime type is supported", async () => {
    supportedRecorderMimeTypes = new Set();
    const onError = vi.fn();

    render(<VoiceRecorder onError={onError} />);
    await act(async () => { fireEvent.click(screen.getByText(/Voice note/)); });

    await waitFor(() => expect(screen.queryByText(/Stop/)).toBeTruthy());
    expect(onError).not.toHaveBeenCalled();
  });

  it("Stop triggers fetch with FormData containing the right keys", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        signal: { signal_id: "SIG-001" },
        transcript: { text: "Kapazitätsproblem" },
        correlator: { incidentIds: ["INC-001"] },
      }),
    } as Response);

    const onSuccess = vi.fn();
    render(<VoiceRecorder sourceSystem="voice_floor" actorUserId="user_042" language="de" onSuccess={onSuccess} />);

    // Start recording
    await act(async () => { fireEvent.click(screen.getByText(/Voice note/)); });
    await waitFor(() => expect(screen.queryByText(/Stop/)).toBeTruthy());

    // Stop and upload
    await act(async () => { fireEvent.click(screen.getByText(/Stop/)); });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/intake/voice");
    expect(opts.method).toBe("POST");
    const body = opts.body as FormData;
    expect(body.get("source_system")).toBe("voice_floor");
    expect(body.get("actor_user_id")).toBe("user_042");
    expect(body.get("language")).toBe("de");
    expect(body.get("audio")).toBeTruthy();
  });

  it.each([
    { supportedMimeTypes: ["audio/mp4"], emittedMimeType: "audio/mp4", expectedExtension: "mp4" },
    { supportedMimeTypes: ["audio/ogg;codecs=opus"], emittedMimeType: "audio/ogg;codecs=opus", expectedExtension: "ogg" },
    { supportedMimeTypes: ["audio/wav"], emittedMimeType: "audio/wav", expectedExtension: "wav" },
    { supportedMimeTypes: ["audio/webm;codecs=opus"], emittedMimeType: "audio/webm;codecs=opus", expectedExtension: "webm" },
    { supportedMimeTypes: [], emittedMimeType: "", expectedExtension: "bin" },
  ])("uses .$expectedExtension filename extension for recorder mime settings", async ({ supportedMimeTypes, emittedMimeType, expectedExtension }) => {
    supportedRecorderMimeTypes = new Set(supportedMimeTypes);
    mockRecorderMimeType = emittedMimeType;
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        signal: { signal_id: "SIG-001" },
        transcript: { text: "ok" },
        correlator: { incidentIds: [] },
      }),
    } as Response);

    render(<VoiceRecorder />);

    await act(async () => { fireEvent.click(screen.getByText(/Voice note/)); });
    await waitFor(() => expect(screen.queryByText(/Stop/)).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByText(/Stop/)); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = opts.body as FormData;
    const uploadedAudio = body.get("audio");
    expect(uploadedAudio).toBeTruthy();
    expect((uploadedAudio as File).name).toBe(`voice-1700000000000.${expectedExtension}`);
  });

  it("200 response transitions to success state and shows transcript snippet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        signal: { signal_id: "SIG-001" },
        transcript: { text: "Maschinenproblem erkannt" },
        correlator: { incidentIds: [] },
      }),
    } as Response);

    const onSuccess = vi.fn();
    render(<VoiceRecorder onSuccess={onSuccess} />);

    await act(async () => { fireEvent.click(screen.getByText(/Voice note/)); });
    await waitFor(() => expect(screen.queryByText(/Stop/)).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByText(/Stop/)); });

    await waitFor(() => expect(screen.queryByText(/Sent/)).toBeTruthy());
    expect(screen.getByText(/Maschinenproblem erkannt/)).toBeTruthy();
    expect(onSuccess).toHaveBeenCalledWith({
      signalId: "SIG-001",
      transcript: "Maschinenproblem erkannt",
      incidentIds: [],
    });
  });

  it("400 response transitions to error state with message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: "INVALID_AUDIO", message: "Audio file is required" }),
    } as Response);

    const onError = vi.fn();
    render(<VoiceRecorder onError={onError} />);

    await act(async () => { fireEvent.click(screen.getByText(/Voice note/)); });
    await waitFor(() => expect(screen.queryByText(/Stop/)).toBeTruthy());
    await act(async () => { fireEvent.click(screen.getByText(/Stop/)); });

    await waitFor(() => expect(screen.queryByText(/Audio file is required/)).toBeTruthy());
    expect(onError).toHaveBeenCalledWith("Audio file is required");
    expect(screen.getByText(/Try again/)).toBeTruthy();
  });

  it("getUserMedia rejection transitions to error state", async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Permission denied"),
    );

    const onError = vi.fn();
    render(<VoiceRecorder onError={onError} />);

    await act(async () => { fireEvent.click(screen.getByText(/Voice note/)); });

    await waitFor(() => expect(screen.queryByText(/Permission denied/)).toBeTruthy());
    expect(onError).toHaveBeenCalledWith("Permission denied");
    expect(screen.getByText(/Try again/)).toBeTruthy();
  });
});
