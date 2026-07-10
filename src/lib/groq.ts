import "server-only";

import Groq from "groq-sdk";

import { getServerEnv } from "@/lib/env";

/** Configured Groq client (OpenAI-compatible). API key + model IDs from env only. */
export function getGroq(): Groq {
  const env = getServerEnv();
  return new Groq({ apiKey: env.GROQ_API_KEY, maxRetries: 3 });
}

/** Model routing (never hardcoded): narrative vs reasoning-heavy sections. */
export function getModels(): { drafting: string; reasoning: string } {
  const env = getServerEnv();
  return { drafting: env.MODEL_DRAFTING, reasoning: env.MODEL_REASONING };
}
