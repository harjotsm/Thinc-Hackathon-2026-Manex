// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { PrototypeFloorScreen } from "../workspace-screens";

afterEach(() => {
  cleanup();
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/voice/voice-recorder", () => ({
  VoiceRecorder: ({
    sourceSystem,
    language,
    onSuccess,
    onError,
    render,
  }: {
    sourceSystem?: string;
    language?: string;
    onSuccess?: (result: { signalId: string; transcript: string; incidentIds: string[] }) => void;
    onError?: (msg: string) => void;
    render?: (controls: {
      state: "idle" | "recording" | "uploading" | "success" | "error";
      duration: number;
      errorMsg: string | null;
      lastTranscript: string | null;
      liveTranscript: string;
      startRecording: () => Promise<void>;
      stopAndUpload: () => Promise<void>;
      reset: () => void;
    }) => ReactNode;
  }) => (
    <div data-testid={`embedded-recorder-${sourceSystem}-${language}`}>
      <div data-testid={`embedded-recorder-mode-${sourceSystem}-${language}`}>
        {render ? "custom" : "default"}
      </div>
      {render?.({
        state: "idle",
        duration: 0,
        errorMsg: null,
        lastTranscript: null,
        liveTranscript: "",
        startRecording: async () => {
          onSuccess?.({ signalId: "SIG-TEST-1", transcript: "Eingesprochener Hinweis", incidentIds: [] });
        },
        stopAndUpload: async () => undefined,
        reset: () => undefined,
      })}
      <button
        type="button"
        onClick={() =>
          onSuccess?.({ signalId: "SIG-TEST-1", transcript: "Eingesprochener Hinweis", incidentIds: [] })
        }
      >
        recorder success
      </button>
      <button type="button" onClick={() => onError?.("Recorder failed")}>
        recorder error
      </button>
    </div>
  ),
}));

describe("PrototypeFloorScreen voice integration", () => {
  it("renders embedded voice recorder in classic variant by default", () => {
    render(<PrototypeFloorScreen />);
    expect(screen.getByTestId("embedded-recorder-voice_floor-de")).toBeTruthy();
    expect(screen.getByTestId("embedded-recorder-mode-voice_floor-de").textContent).toBe("custom");
  });

  it("renders embedded voice recorder in minimal and chat variants", () => {
    render(<PrototypeFloorScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Minimal" }));
    expect(screen.getByTestId("embedded-recorder-voice_floor-de")).toBeTruthy();
    expect(screen.getByTestId("embedded-recorder-mode-voice_floor-de").textContent).toBe("custom");

    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByTestId("embedded-recorder-voice_floor-de")).toBeTruthy();
    expect(screen.getByTestId("embedded-recorder-mode-voice_floor-de").textContent).toBe("custom");
  });

  it("uses recorder success transcript to enable submit", () => {
    render(<PrototypeFloorScreen />);
    const sendBtn = screen.getByRole("button", { name: "Bericht senden" });
    expect(sendBtn.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "recorder success" }));

    expect(screen.getAllByText(/Eingesprochener Hinweis/i).length).toBeGreaterThan(0);
    expect(sendBtn.getAttribute("disabled")).toBeNull();
  });

  it("fills the editable description textarea from recorder transcript", () => {
    render(<PrototypeFloorScreen />);
    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textbox.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "recorder success" }));

    expect(textbox.value).toBe("Eingesprochener Hinweis");
  });
});
