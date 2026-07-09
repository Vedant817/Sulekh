import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv } from "@/lib/env";

/** Configured Anthropic client. API key + model IDs come from env only. */
export function getAnthropic(): Anthropic {
  const env = getServerEnv();
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 3 });
}

/** Model routing (never hardcoded): narrative vs. reasoning-heavy sections. */
export function getModels(): { drafting: string; reasoning: string } {
  const env = getServerEnv();
  return { drafting: env.MODEL_DRAFTING, reasoning: env.MODEL_REASONING };
}
