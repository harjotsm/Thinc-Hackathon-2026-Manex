import "server-only";

import OpenAI from "openai";
import { env } from "@/lib/env";

const openAiApiKey = env.required("OPENAI_API_KEY");

let client: OpenAI | undefined;

export const getOpenAIClient = (): OpenAI => {
  if (!client) {
    client = new OpenAI({ apiKey: openAiApiKey });
  }

  return client;
};
