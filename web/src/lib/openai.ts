import "server-only";

import OpenAI from "openai";
import { env } from "@/lib/env";

let client: OpenAI | undefined;

export const getOpenAIClient = (): OpenAI => {
  if (!client) {
    client = new OpenAI({ apiKey: env.openAiApiKey });
  }

  return client;
};
