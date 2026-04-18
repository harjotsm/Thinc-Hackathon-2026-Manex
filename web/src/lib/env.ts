const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

const optional = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
};

export const env = {
  publicSupabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_MANEX_API_URL,
  publicSupabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_MANEX_ANON_KEY,
  serverSupabaseUrl: process.env.MANEX_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  serverSupabaseServiceKey:
    process.env.MANEX_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  openAiApiKey: optional("OPENAI_API_KEY"),
  required,
};
