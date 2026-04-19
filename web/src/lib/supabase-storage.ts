import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let client: ReturnType<typeof createClient> | null = null;

const getStorageClient = () => {
  const url = env.serverSupabaseUrl;
  const key = env.serverSupabaseServiceKey ?? env.publicSupabaseAnonKey;
  if (!url || !key) {
    throw new Error("Missing server Supabase configuration for Storage.");
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
};

export const VOICE_BUCKET = "voice-signals";

export type StoredAudioRef = { bucket: string; path: string; publicUrl: string | null };

export const uploadVoiceClip = async (
  file: Buffer | Blob,
  filenameHint: string,
  contentType: string,
): Promise<StoredAudioRef> => {
  // Best-effort: ensure the bucket exists before uploading.
  // If bucket creation is denied by RLS, we log a warning and attempt the upload
  // anyway (it will fail with a clear message if the bucket truly doesn't exist).
  try {
    await ensureVoiceBucket();
  } catch (bucketErr) {
    console.warn(
      `[supabase-storage] Could not ensure bucket "${VOICE_BUCKET}" exists — ` +
        `create it manually in the Supabase dashboard if uploads fail. Error: ${String(bucketErr)}`,
    );
  }

  const c = getStorageClient();
  // Path schema: voice/<yyyy>/<mm>/<dd>/<uuid>-<safe-filename>
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const safeName = filenameHint.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const path = `voice/${yyyy}/${mm}/${dd}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await c.storage.from(VOICE_BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: pub } = c.storage.from(VOICE_BUCKET).getPublicUrl(path);
  return { bucket: VOICE_BUCKET, path, publicUrl: pub.publicUrl ?? null };
};

export const ensureVoiceBucket = async () => {
  // Best-effort idempotent bucket creation. Safe to call on every cold start.
  const c = getStorageClient();
  const { error } = await c.storage.createBucket(VOICE_BUCKET, { public: true });
  // Ignore "already exists" — match by message substring
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Bucket ensure failed: ${error.message}`);
  }
};
