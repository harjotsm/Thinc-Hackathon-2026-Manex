# Voice Intake Reliability + Free-Text Fallback Design

## Problem

The `/floor` voice flow currently fails closed when speech-to-text errors occur, which blocks the signal -> correlator -> incident -> orchestrator loop needed for the operator demo path.

## Goals

1. Make OpenAI configuration fail fast at app startup.
2. Improve upload/transcription reliability across browser MIME types.
3. Preserve pipeline continuity by falling back to free-text signal creation when Whisper fails and operator text is available.
4. Add a live smoke test that validates voice intake through report evidence.

## Non-goals

- Voice playback in Engineer lens.
- Multi-speaker diarization.
- Post-transcription correction UX.

## Architecture

Keep the existing synchronous `POST /api/intake/voice` route as the canonical intake path and harden it:

- `OPENAI_API_KEY` is required at boot in `web/src/lib/env.ts`.
- `getOpenAIClient()` becomes non-null and always returns an initialized OpenAI client.
- Voice intake retains current shape (upload -> transcribe -> embed -> signal insert -> correlator run), but adds a controlled fallback branch when transcription fails and free text is present.

## Components and Changes

### 1) Environment and OpenAI client

- `web/src/lib/env.ts`
  - Change `openAiApiKey` from optional to required.
- `web/src/lib/openai.ts`
  - Remove nullable client return path.
  - Construct singleton with required key.

### 2) MIME/filename propagation

- `web/src/components/voice/voice-recorder.tsx`
  - Preserve recorder MIME at upload time.
  - Choose extension from MIME (`webm`, `mp4`, fallback `bin`) instead of hardcoding `.webm`.
- `web/src/server/transcription.ts`
  - Build `File` objects from actual incoming blob metadata.
  - Avoid forcing `audio/webm` when source provides a valid type.

### 3) Voice intake fallback behavior

- `web/src/app/api/intake/voice/route.ts`
  - Primary path unchanged for successful transcription.
  - On transcription failure:
    - If operator note/free text exists: create signal using that text, mark audio attachment `status: "failed"`, and persist transcription error details in `raw_payload.transcription_error`.
    - If no fallback text exists: return `transcription_error`.
  - Continue correlator execution for both successful transcription and fallback-created signals.

### 4) Downstream compatibility

- Preserve `text_payload` as the canonical text consumed by correlator/orchestrator.
- Keep `source_system = "floor"` semantics from caller inputs.
- Ensure signal shape remains compatible with existing schema parsing and incident loaders.

## Data Flow

1. UI records audio and POSTs multipart to `/api/intake/voice` with optional note text.
2. Route uploads audio to storage.
3. Route attempts Whisper transcription.
4. Route composes signal text:
   - success: `note + transcript` (when note exists),
   - fallback: `note` only (when transcription fails but note exists).
5. Route generates embedding for composed text.
6. Route inserts `signal` row with attachment metadata and explicit transcription outcome.
7. Route invokes correlator; new incidents are linked and can trigger orchestrator dispatch.
8. Report endpoint returns output whose evidence trail can include transcript/fallback text.

## Error Handling

- Configuration errors fail at startup (missing `OPENAI_API_KEY`).
- Storage and DB failures remain hard API errors.
- Transcription failures become recoverable only when free-text fallback exists.
- Correlator failures remain non-fatal to intake response, preserving inserted signal.

## Testing Strategy

1. Update existing unit tests for env/client and MIME handling.
2. Extend route tests for:
   - fallback insert when Whisper fails + note exists,
   - hard failure when Whisper fails + no note,
   - attachment status/error metadata.
3. Add one live smoke command (real OpenAI/runtime) that verifies:
   - intake call creates signal row,
   - correlator links/creates incident,
   - orchestrator/report path contains submitted transcript text in evidence.

The live smoke runs as an explicit command, not as default unit test execution.

## Acceptance Mapping

- Floor voice sentence reaches Engineer inbox as signal payload.
- No runtime-only missing-key surprises (startup fails fast instead).
- Smoke command validates end-to-end evidence trail continuity.
