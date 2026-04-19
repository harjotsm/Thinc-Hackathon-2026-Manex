# Handoff — Voice / Whisper pipeline + free-text ingest

**Owner for this task:** pick up from feat/joscha or feat/harjot (data layer) and land on your own branch → PR to develop.

**Urgency:** blocks Story 4 (Operator handling) demo. Floor lens is the only way
a shop-floor user submits evidence in today's UX. If speech-to-text fails,
signals never enter the reporting / LLM pipeline, and the Floor → Inbox loop
stays broken during the demo.

## Symptom

Current Floor capture flow produces errors at speech-to-text step. Effect:
`/floor` recordings don't appear as signals in `/inbox`, so the orchestrator
never sees them and the Engineer lens can't reason about what the shop-floor
operator just reported.

## Scope of the fix

Three connected concerns. Treat them together — fixing only one leaves a
half-broken loop.

### 1. `OPENAI_API_KEY` must be configured

- Env var: `OPENAI_API_KEY` in [web/.env.local](../web/.env.local) (and
  wherever prod/demo env is injected).
- Loader: [web/src/lib/env.ts](../web/src/lib/env.ts#L23) treats it as
  `optional()` today — `getOpenAIClient()` returns `null` when missing, and
  [transcription.ts](../web/src/server/transcription.ts#L18) throws
  `"OpenAI client is not configured (missing OPENAI_API_KEY)."`.
- **Action:** confirm the key is present in the demo environment. Consider
  promoting it to `required()` in env.ts so we fail fast at boot instead of
  at first upload.

### 2. Whisper endpoint + upload reliability

Entry points:
- API route: [web/src/app/api/intake/voice/route.ts](../web/src/app/api/intake/voice/route.ts)
- Server helper: [web/src/server/transcription.ts](../web/src/server/transcription.ts)
  (`model: "whisper-1"`, accepts `Buffer | Blob`)
- UI: [web/src/components/voice/voice-recorder.tsx](../web/src/components/voice/voice-recorder.tsx)
- Existing tests: [web/src/app/api/intake/voice/__tests__/route.test.ts](../web/src/app/api/intake/voice/__tests__/route.test.ts),
  [web/src/server/__tests__/transcription.test.ts](../web/src/server/__tests__/transcription.test.ts),
  [web/src/components/voice/__tests__/voice-recorder.test.tsx](../web/src/components/voice/__tests__/voice-recorder.test.tsx)

**Likely failure modes to check**, in order of suspicion:
1. MIME mismatch between the browser-recorded blob (`audio/webm;codecs=opus`)
   and what the `File` constructor forwards to the SDK. Today we hard-code
   `type: "audio/webm"` — safari emits `audio/mp4`.
2. Network timeout on large recordings (no streaming today).
3. Signal row is created with `status: "pending"` and never transitioned to
   `"transcribed"` if transcription throws asynchronously — check the
   status-transition path in the voice intake route.

### 3. Downstream: make sure transcripts flow into signals → orchestrator

German + English free text coexists; the transcription result ends up in
`signal.text_payload`. Verify the full loop end-to-end:

1. `/floor` records → POST `/api/intake/voice` → OpenAI Whisper → `transcript`
2. Row written to `signal` table with `source_system = "floor"`,
   `text_payload = transcript.text`, `status = "transcribed"`.
3. Correlator (`web/src/server/correlator/run.ts`) picks it up on next tick
   and groups it into a theme.
4. Theme appears in `/inbox` with a visible cluster row.
5. Clicking through to the incident and hitting `Run AI` → orchestrator
   classifies + investigates using the transcript as evidence.

Add one smoke test that walks the whole loop against the seeded DB —
transcript string in, incident visible in `/incidents`, transcript cited in
the report's evidence trail.

## Acceptance

- Demo flow: on `/floor` I can record "Die ElektroParts Batch SB-00007
  Kondensatoren kommen immer warm an, ich hatte heute drei Ausfälle" (German,
  mixed entities), and within 20 s that sentence appears verbatim as a signal
  payload in the Engineer lens inbox.
- Smoke test covers: voice upload → signal row → theme → orchestrator → report
  evidence trail containing the transcript.
- No `OPENAI_API_KEY` missing errors in dev logs.

## Non-goals for this task

- Voice playback in the Engineer lens (v2).
- Speaker diarisation / multi-speaker handling.
- Free-text corrections UI after transcription (v2).

Ping in Slack once merged so we can re-smoke the supplier + operator stories
against a fresh voice signal.
