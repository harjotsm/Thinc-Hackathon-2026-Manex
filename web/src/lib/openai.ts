import "server-only";

import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | null = null;

export const getOpenAIClient = () => {
  if (!env.openAiApiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: env.openAiApiKey });
  }

  return client;
};
