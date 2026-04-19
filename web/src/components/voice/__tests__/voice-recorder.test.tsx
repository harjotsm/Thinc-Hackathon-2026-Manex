// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { VoiceRecorder } from "../voice-recorder";

// --- MediaRecorder stub ---
let mockRecorderMimeType = "audio/webm";

class MockMediaRecorder {
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = mockRecorderMimeType;
  constructor(public stream: MediaStream, public opts?: MediaRecorderOptions) {}
  start(_timeslice?: number) { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["fake"], { type: this.mimeType }) });
      this.onstop?.();
    }, 0);
  }
  static isTypeSupported(_mime: string) { return true; }
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
    { mimeType: "audio/mp4", expectedExtension: "mp4" },
    { mimeType: "audio/ogg", expectedExtension: "ogg" },
    { mimeType: "audio/wav", expectedExtension: "wav" },
    { mimeType: "audio/webm", expectedExtension: "webm" },
    { mimeType: "audio/x-custom", expectedExtension: "bin" },
  ])("uses .$expectedExtension filename extension for $mimeType uploads", async ({ mimeType, expectedExtension }) => {
    mockRecorderMimeType = mimeType;
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
