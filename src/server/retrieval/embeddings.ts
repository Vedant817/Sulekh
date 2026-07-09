import { z } from "zod";

/**
 * Embedding provider abstraction (typed adapter). Default provider is Google
 * Gemini (free tier), configured via env; swappable to other providers without
 * touching callers. Real HTTP calls only — never fabricated vectors. Failures
 * surface loudly (throw), never a silent empty result.
 */

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dim: number;
  /** Max inputs per upstream request. */
  readonly batchSize: number;
  embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]>;
}

const embeddingEnvSchema = z.object({
  EMBEDDINGS_PROVIDER: z.string().min(1).default("gemini"),
  EMBEDDINGS_API_KEY: z.string().min(1, "EMBEDDINGS_API_KEY is required for embeddings"),
  EMBEDDINGS_MODEL: z.string().min(1).default("text-embedding-004"),
  EMBEDDINGS_DIM: z.coerce.number().int().positive().default(768),
});

function readConfig() {
  const parsed = embeddingEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Embeddings misconfigured:\n  - ${issues.join("\n  - ")}`);
  }
  return parsed.data;
}

/** Google Gemini embeddings via the Generative Language REST API. */
class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini";
  readonly batchSize = 100;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly dim: number,
  ) {}

  async embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > this.batchSize) {
      throw new Error(`Gemini batch limit is ${this.batchSize}; got ${texts.length}`);
    }
    const modelPath = `models/${this.model}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:batchEmbedContents?key=${this.apiKey}`;
    const body = {
      requests: texts.map((text) => ({
        model: modelPath,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: this.dim,
      })),
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Gemini embeddings HTTP ${res.status}: ${detail.slice(0, 400)}`);
    }
    const json = (await res.json()) as { embeddings?: { values: number[] }[] };
    const embeddings = json.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs`,
      );
    }
    return embeddings.map((e, i) => {
      const v = e.values ?? [];
      if (v.length !== this.dim) {
        throw new Error(`Embedding ${i} has dim ${v.length}, expected ${this.dim}`);
      }
      return v;
    });
  }
}

let cached: EmbeddingProvider | undefined;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  const cfg = readConfig();
  switch (cfg.EMBEDDINGS_PROVIDER) {
    case "gemini":
      cached = new GeminiEmbeddingProvider(cfg.EMBEDDINGS_API_KEY, cfg.EMBEDDINGS_MODEL, cfg.EMBEDDINGS_DIM);
      return cached;
    default:
      throw new Error(
        `Unsupported EMBEDDINGS_PROVIDER "${cfg.EMBEDDINGS_PROVIDER}". Add an adapter in embeddings.ts.`,
      );
  }
}

/** Format a numeric vector as a pgvector literal: [v1,v2,...]. */
export function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}
