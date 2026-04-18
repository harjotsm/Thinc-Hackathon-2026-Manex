"use client";

import { useState } from "react";

type CaptureResponse = {
  signal?: { signal_id: string };
  correlator?: { incidentIds: string[] };
  error?: string;
};

export default function OperatorCapturePage() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("operator_voice");
  const [signalType, setSignalType] = useState("worker_report");
  const [status, setStatus] = useState<string>("");

  const submit = async () => {
    setStatus("Submitting signal...");
    const response = await fetch("/api/intake/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal_type: signalType,
        source_system: source,
        text_payload: text,
        raw_payload: { channel: "floor_lens", submitted_at: new Date().toISOString() },
      }),
    });

    const json = (await response.json()) as CaptureResponse;
    if (!response.ok) {
      setStatus(`Failed: ${json.error ?? "unknown error"}`);
      return;
    }

    setStatus(
      `Signal ${json.signal?.signal_id ?? "created"} recorded. ${
        json.correlator?.incidentIds?.[0] ? `Incident ${json.correlator.incidentIds[0]} opened.` : ""
      }`,
    );
    setText("");
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Floor Lens — Capture</h1>
      <p className="text-sm text-zinc-600">
        Report anything unusual on the line. This creates a normalized signal and triggers correlation.
      </p>

      <label className="text-sm font-medium">Signal type</label>
      <input
        value={signalType}
        onChange={(event) => setSignalType(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2"
      />

      <label className="text-sm font-medium">Source system</label>
      <input
        value={source}
        onChange={(event) => setSource(event.target.value)}
        className="rounded border border-zinc-300 px-3 py-2"
      />

      <label className="text-sm font-medium">What happened?</label>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        className="rounded border border-zinc-300 px-3 py-2"
        placeholder="Example: unusual ESR near-limit pattern on batch SB-00007..."
      />

      <button
        onClick={submit}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        disabled={!text.trim()}
      >
        Submit signal
      </button>

      {status ? <p className="rounded bg-zinc-100 px-3 py-2 text-sm">{status}</p> : null}
    </main>
  );
}
