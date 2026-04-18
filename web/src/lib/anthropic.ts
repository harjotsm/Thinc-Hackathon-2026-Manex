import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let client: Anthropic | null = null;

export const getAnthropicClient = () => {
  if (!env.anthropicApiKey) {
    return null;
  }

  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  return client;
};
