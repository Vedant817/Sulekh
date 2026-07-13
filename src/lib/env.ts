import { z } from "zod";

/**
 * Typed environment loader.
 *
 * Required variables fail fast at boot with a single, clear, named error that
 * enumerates every offending variable — never a silent `undefined` propagating
 * into a runtime call. Optional credentialed providers (MCA/GST) may be blank:
 * a blank provider falls through to its real default adapter (upload + parse)
 * and never fabricates data.
 *
 * Model IDs are read from env (MODEL_DRAFTING / MODEL_REASONING) and are never
 * hardcoded in source, per the project's non-negotiables.
 */

const nonEmpty = (name: string) =>
  z.string({ required_error: `${name} is required` }).trim().min(1, `${name} must not be empty`);

export const serverEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty("NEXT_PUBLIC_SUPABASE_URL").url(
    "NEXT_PUBLIC_SUPABASE_URL must be a valid URL",
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty("SUPABASE_SERVICE_ROLE_KEY"),

  // Groq (LLM provider — OpenAI-compatible; hosts Llama / GPT-OSS / Kimi etc.)
  GROQ_API_KEY: nonEmpty("GROQ_API_KEY"),
  MODEL_DRAFTING: nonEmpty("MODEL_DRAFTING"),
  MODEL_REASONING: nonEmpty("MODEL_REASONING"),

  // Embeddings — local Transformers.js is the quota-free default. The API key
  // is only required when explicitly selecting the optional Gemini adapter.
  EMBEDDINGS_PROVIDER: nonEmpty("EMBEDDINGS_PROVIDER").default("local"),
  EMBEDDINGS_API_KEY: z.string().trim().optional().default(""),
  EMBEDDINGS_MODEL: nonEmpty("EMBEDDINGS_MODEL").default("Xenova/bge-base-en-v1.5"),
  EMBEDDINGS_MODEL_REVISION: nonEmpty("EMBEDDINGS_MODEL_REVISION").default(
    "4d6cd88e18e51a5e020c2c305726d76ada9c03cf",
  ),
  EMBEDDINGS_CACHE_DIR: z.string().trim().optional().default(""),
  EMBEDDINGS_DIM: z.coerce
    .number({ invalid_type_error: "EMBEDDINGS_DIM must be a number" })
    .int("EMBEDDINGS_DIM must be an integer")
    .positive("EMBEDDINGS_DIM must be positive")
    .default(768),

  // App
  APP_URL: nonEmpty("APP_URL").url("APP_URL must be a valid URL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Optional credentialed providers (blank => real default adapter, never faked)
  MCA_API_KEY: z.string().trim().optional().default(""),
  GST_API_KEY: z.string().trim().optional().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Public (client-safe) subset — only NEXT_PUBLIC_* values may reach the browser. */
export const clientEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
});
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Client-safe env accessor. Reads only the NEXT_PUBLIC_* variables, which Next
 * inlines at build time, so this is safe to call in the browser. Throws an
 * {@link EnvValidationError} if a public var is missing/malformed.
 */
export function getClientEnv(): ClientEnv {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new EnvValidationError(issues);
  }
  return result.data;
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Invalid environment configuration. Fix the following variable(s):\n` +
        issues.map((i) => `  - ${i}`).join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

/**
 * Pure parser — validate a raw record and return typed env, or throw an
 * {@link EnvValidationError} naming every offending variable. Kept pure so it
 * is unit-testable without touching `process.env`.
 */
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join(".") || "(root)";
      return `${key}: ${issue.message}`;
    });
    throw new EnvValidationError(issues);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/**
 * Memoized, server-only accessor. First call validates `process.env` and fails
 * fast on any missing/invalid required variable.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser");
  }
  if (!cached) {
    cached = parseServerEnv(process.env);
  }
  return cached;
}

/** Test-only: clear the memoized env (no-op in production paths). */
export function __resetServerEnvCache(): void {
  cached = undefined;
}
