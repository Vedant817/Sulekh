import { describe, expect, it } from "vitest";

import {
  GEMINI_EMBEDDING_MODEL,
  LOCAL_EMBEDDING_MODEL,
  resolveEmbeddingModel,
} from "@/server/retrieval/embeddings";

describe("embedding model configuration", () => {
  it("uses the local BGE default for the local provider", () => {
    expect(resolveEmbeddingModel("local", "")).toBe(LOCAL_EMBEDDING_MODEL);
  });

  it("uses a Gemini model default when Gemini is selected", () => {
    expect(resolveEmbeddingModel("gemini", "")).toBe(GEMINI_EMBEDDING_MODEL);
  });

  it("preserves an explicitly configured provider model", () => {
    expect(resolveEmbeddingModel("gemini", "custom-google-model")).toBe(
      "custom-google-model",
    );
  });
});
