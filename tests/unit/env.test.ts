import { describe, expect, it } from "vitest";

import { EnvValidationError, parseServerEnv } from "@/lib/env";

const validRaw = {
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  ANTHROPIC_API_KEY: "sk-ant-xxx",
  MODEL_DRAFTING: "claude-sonnet-5",
  MODEL_REASONING: "claude-opus-4-8",
  EMBEDDINGS_API_KEY: "emb-key",
  EMBEDDINGS_MODEL: "text-embedding-004",
  APP_URL: "http://localhost:3000",
} satisfies Record<string, string>;

describe("parseServerEnv", () => {
  it("parses a complete config and applies typed defaults", () => {
    const env = parseServerEnv(validRaw);
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-xxx");
    expect(env.EMBEDDINGS_PROVIDER).toBe("gemini");
    expect(env.EMBEDDINGS_DIM).toBe(768);
    expect(typeof env.EMBEDDINGS_DIM).toBe("number");
    expect(env.NODE_ENV).toBe("development");
    // Optional credentialed providers default to empty (real default adapter).
    expect(env.MCA_API_KEY).toBe("");
    expect(env.GST_API_KEY).toBe("");
  });

  it("coerces EMBEDDINGS_DIM from string to number", () => {
    const env = parseServerEnv({ ...validRaw, EMBEDDINGS_DIM: "1536" });
    expect(env.EMBEDDINGS_DIM).toBe(1536);
  });

  it("throws a clear, named error when a required var is missing", () => {
    const { ANTHROPIC_API_KEY, ...missing } = validRaw;
    void ANTHROPIC_API_KEY;
    expect(() => parseServerEnv(missing)).toThrow(EnvValidationError);
    try {
      parseServerEnv(missing);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      const e = err as EnvValidationError;
      expect(e.message).toContain("ANTHROPIC_API_KEY");
      expect(e.issues.some((i) => i.includes("ANTHROPIC_API_KEY"))).toBe(true);
    }
  });

  it("names every offending var, not just the first", () => {
    const { ANTHROPIC_API_KEY, EMBEDDINGS_API_KEY, ...missing } = validRaw;
    void ANTHROPIC_API_KEY;
    void EMBEDDINGS_API_KEY;
    try {
      parseServerEnv(missing);
      expect.unreachable("should have thrown");
    } catch (err) {
      const e = err as EnvValidationError;
      expect(e.message).toContain("ANTHROPIC_API_KEY");
      expect(e.message).toContain("EMBEDDINGS_API_KEY");
    }
  });

  it("rejects a malformed URL with a named message", () => {
    expect(() => parseServerEnv({ ...validRaw, APP_URL: "not-a-url" })).toThrow(
      /APP_URL/,
    );
  });
});
