import "server-only";

import { PostgrestClient } from "@supabase/postgrest-js";
import { env } from "@/lib/env";

export const getSupabaseServerClient = () => {
  const url = env.serverSupabaseUrl;
  const key = env.serverSupabaseServiceKey ?? env.publicSupabaseAnonKey;

  if (!url || !key) {
    throw new Error(
      "Missing server Supabase configuration. Set MANEX_API_URL and MANEX_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return new PostgrestClient(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
};
