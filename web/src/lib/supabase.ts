"use client";

import { PostgrestClient } from "@supabase/postgrest-js";
import { env } from "@/lib/env";

let browserClient: PostgrestClient | null = null;

export const getSupabaseBrowserClient = () => {
  if (!env.publicSupabaseUrl || !env.publicSupabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or MANEX aliases).",
    );
  }

  if (!browserClient) {
    browserClient = new PostgrestClient(env.publicSupabaseUrl, {
      headers: {
        apikey: env.publicSupabaseAnonKey,
        Authorization: `Bearer ${env.publicSupabaseAnonKey}`,
      },
    });
  }

  return browserClient;
};
