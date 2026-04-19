import "server-only";
import { EventEmitter } from "node:events";

// Module-level singleton survives per worker.
declare global {
  // eslint-disable-next-line no-var
  var __resolveEventBus: EventEmitter | undefined;
}

export const eventBus =
  globalThis.__resolveEventBus ??
  (globalThis.__resolveEventBus = new EventEmitter());
eventBus.setMaxListeners(200);

export type SessionEventPayload = {
  event_seq: number;
  event_type: string;
  payload: unknown;
  ts: string;
};

// Typed helpers

export const publishSessionEvent = (
  session_id: string,
  event: SessionEventPayload,
) => eventBus.emit(`session:${session_id}`, event);

export const subscribeSessionEvents = (
  session_id: string,
  cb: (event: SessionEventPayload) => void,
): (() => void) => {
  const listener = (e: SessionEventPayload) => cb(e);
  eventBus.on(`session:${session_id}`, listener);
  return () => eventBus.off(`session:${session_id}`, listener);
};
