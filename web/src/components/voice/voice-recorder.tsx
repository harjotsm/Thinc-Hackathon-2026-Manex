"use client";
import { useState, useRef, useCallback } from "react";

type RecorderState = "idle" | "recording" | "uploading" | "success" | "error";

type Props = {
  sourceSystem?: string;
  actorUserId?: string;
  language?: string;
  defaultNote?: string;
  onSuccess?: (result: { signalId: string; transcript: string; incidentIds: string[] }) => void;
  onError?: (msg: string) => void;
};

const getAudioExtensionFromMime = (mimeType: string): string => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("webm")) return "webm";
  return "bin";
};

const resolveRecorderMimeType = (): string | null => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return null;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav",
    "audio/mpeg",
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const VoiceRecorder = ({
  sourceSystem = "voice_floor",
  actorUserId,
  language,
  defaultNote,
  onSuccess,
  onError,
}: Props) => {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setErrorMsg(null);
      setState("recording");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = resolveRecorderMimeType();
      let rec: MediaRecorder;
      if (mimeType) {
        try {
          rec = new MediaRecorder(stream, { mimeType });
        } catch {
          rec = new MediaRecorder(stream);
        }
      } else {
        rec = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(250);
      startedAtRef.current = Date.now();
      tickRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone access denied";
      setErrorMsg(msg);
      setState("error");
      cleanup();
      onError?.(msg);
    }
  }, [cleanup, onError]);

  const stopAndUpload = useCallback(async (note?: string) => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
    // Wait for the final dataavailable event
    await new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    const chunkType = chunksRef.current.find((chunk) => chunk.type)?.type ?? "";
    const resolvedType = rec.mimeType || chunkType;
    const blob = resolvedType
      ? new Blob(chunksRef.current, { type: resolvedType })
      : new Blob(chunksRef.current);
    cleanup();
    if (blob.size === 0) {
      setErrorMsg("No audio captured");
      setState("error");
      return;
    }
    setState("uploading");
    const fd = new FormData();
    const extension = getAudioExtensionFromMime(blob.type || rec.mimeType || chunkType);
    fd.append("audio", blob, `voice-${Date.now()}.${extension}`);
    fd.append("source_system", sourceSystem);
    if (actorUserId) fd.append("actor_user_id", actorUserId);
    if (language) fd.append("language", language);
    const finalNote = note ?? defaultNote;
    if (finalNote) fd.append("note", finalNote);
    try {
      const res = await fetch("/api/intake/voice", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message ?? `Upload failed (${res.status})`;
        setErrorMsg(msg); setState("error"); onError?.(msg); return;
      }
      setLastTranscript(json.transcript?.text ?? null);
      setState("success");
      onSuccess?.({
        signalId: json.signal?.signal_id ?? "",
        transcript: json.transcript?.text ?? "",
        incidentIds: json.correlator?.incidentIds ?? [],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMsg(msg); setState("error"); onError?.(msg);
    }
  }, [sourceSystem, actorUserId, language, defaultNote, onSuccess, onError, cleanup]);

  const reset = () => { setState("idle"); setDuration(0); setLastTranscript(null); setErrorMsg(null); };

  return (
    <div data-testid="voice-recorder" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
      {state === "idle" && (
        <button type="button" onClick={startRecording} style={btnStyle("idle")}>
          🎙 Voice note
        </button>
      )}
      {state === "recording" && (
        <button type="button" onClick={() => stopAndUpload()} style={btnStyle("recording")}>
          ⏹ Stop · {duration}s
        </button>
      )}
      {state === "uploading" && (
        <span style={btnStyle("uploading")}>Uploading &amp; transcribing…</span>
      )}
      {state === "success" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={btnStyle("success")}>✓ Sent</span>
          {lastTranscript && (
            <span style={{ fontSize: 12, color: "#475569", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              &quot;{lastTranscript}&quot;
            </span>
          )}
          <button type="button" onClick={reset} style={resetStyle}>Record another</button>
        </div>
      )}
      {state === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={btnStyle("error")}>✗ {errorMsg}</span>
          <button type="button" onClick={reset} style={resetStyle}>Try again</button>
        </div>
      )}
    </div>
  );
};

const btnStyle = (s: RecorderState): React.CSSProperties => {
  const base: React.CSSProperties = {
    border: "none", borderRadius: 999, padding: "10px 18px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  };
  switch (s) {
    case "idle":      return { ...base, background: "#1e40af", color: "white" };
    case "recording": return { ...base, background: "#dc2626", color: "white", animation: "pulse 1s infinite" };
    case "uploading": return { ...base, background: "#f1f5f9", color: "#64748b", cursor: "default" };
    case "success":   return { ...base, background: "#16a34a", color: "white", cursor: "default" };
    case "error":     return { ...base, background: "#fef2f2", color: "#991b1b", cursor: "default" };
    default:          return base;
  }
};
const resetStyle: React.CSSProperties = {
  background: "transparent", border: "1px solid #cbd5e1",
  padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#475569",
};
