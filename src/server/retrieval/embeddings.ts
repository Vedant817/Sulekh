import { z } from "zod";
import type { FeatureExtractionPipelineType } from "@huggingface/transformers";

/**
 * Embedding provider abstraction (typed adapter). The default is local ONNX
 * inference through Transformers.js, so corpus and query embedding have no API
 * quota and regulatory text never leaves the host. Gemini remains an optional
 * adapter. Failures surface loudly; vectors are always dimension/finite checked.
 */

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dim: number;
  /** Identifies one comparable vector space (provider + model revision/variant). */
  readonly signature: string;
  /** Max inputs per upstream request. */
  readonly batchSize: number;
  embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]>;
  dispose?(): Promise<void>;
}

const embeddingEnvSchema = z.object({
  EMBEDDINGS_PROVIDER: z.enum(["local", "gemini"]).default("local"),
  EMBEDDINGS_API_KEY: z.string().trim().optional().default(""),
  EMBEDDINGS_MODEL: z.string().min(1).default("Xenova/bge-base-en-v1.5"),
  EMBEDDINGS_MODEL_REVISION: z
    .string()
    .min(1)
    .default("4d6cd88e18e51a5e020c2c305726d76ada9c03cf"),
  EMBEDDINGS_DIM: z.coerce.number().int().positive().default(768),
}).superRefine((value, ctx) => {
  if (value.EMBEDDINGS_PROVIDER === "gemini" && !value.EMBEDDINGS_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["EMBEDDINGS_API_KEY"],
      message: "EMBEDDINGS_API_KEY is required when EMBEDDINGS_PROVIDER=gemini",
    });
  }
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
  readonly signature: string;
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    readonly dim: number,
  ) {
    this.signature = `${this.name}:${this.model}:${this.dim}`;
  }

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

const BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

/** Quota-free, in-process BGE embeddings using pinned ONNX model weights. */
class LocalTransformersEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly batchSize = 16;
  readonly signature: string;
  private extractorPromise: Promise<FeatureExtractionPipelineType> | undefined;

  constructor(
    readonly model: string,
    private readonly revision: string,
    readonly dim: number,
  ) {
    this.signature = `${this.name}:${this.model}@${this.revision}:q8:${this.dim}`;
  }

  private getExtractor(): Promise<FeatureExtractionPipelineType> {
    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        const { env, pipeline } = await import("@huggingface/transformers");
        env.cacheDir = `${process.cwd()}/.cache/transformers`;
        // Narrow the library's all-pipelines generic: TypeScript otherwise
        // expands every supported task/model combination into an unusable union.
        const createFeatureExtractor = pipeline as unknown as (
          task: "feature-extraction",
          model: string,
          options: { revision: string; dtype: "q8"; device: "cpu" },
        ) => Promise<FeatureExtractionPipelineType>;
        return createFeatureExtractor("feature-extraction", this.model, {
          revision: this.revision,
          dtype: "q8",
          device: "cpu",
        });
      })();
    }
    return this.extractorPromise;
  }

  async embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length > this.batchSize) {
      throw new Error(`Local embedding batch limit is ${this.batchSize}; got ${texts.length}`);
    }
    const inputs =
      taskType === "RETRIEVAL_QUERY"
        ? texts.map((text) => `${BGE_QUERY_PREFIX}${text}`)
        : texts;

    const extractor = await this.getExtractor();
    const tensor = await extractor(inputs, { pooling: "mean", normalize: true });
    const vectors = tensor.tolist() as unknown;
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      throw new Error(`Local model returned an invalid batch for ${texts.length} input(s)`);
    }
    return vectors.map((raw, index) => {
      if (!Array.isArray(raw) || raw.length !== this.dim) {
        throw new Error(
          `Local embedding ${index} has dim ${Array.isArray(raw) ? raw.length : "invalid"}, expected ${this.dim}`,
        );
      }
      const vector = raw.map(Number);
      if (!vector.every(Number.isFinite)) {
        throw new Error(`Local embedding ${index} contains a non-finite value`);
      }
      return vector;
    });
  }

  async dispose(): Promise<void> {
    if (!this.extractorPromise) return;
    const extractor = await this.extractorPromise;
    await extractor.dispose();
    this.extractorPromise = undefined;
  }
}

let cached: EmbeddingProvider | undefined;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  const cfg = readConfig();
  switch (cfg.EMBEDDINGS_PROVIDER) {
    case "local":
      cached = new LocalTransformersEmbeddingProvider(
        cfg.EMBEDDINGS_MODEL,
        cfg.EMBEDDINGS_MODEL_REVISION,
        cfg.EMBEDDINGS_DIM,
      );
      return cached;
    case "gemini":
      cached = new GeminiEmbeddingProvider(cfg.EMBEDDINGS_API_KEY, cfg.EMBEDDINGS_MODEL, cfg.EMBEDDINGS_DIM);
      return cached;
    default:
      throw new Error(
        `Unsupported EMBEDDINGS_PROVIDER "${cfg.EMBEDDINGS_PROVIDER}". Add an adapter in embeddings.ts.`,
      );
  }
}

/** Test/process utility: do not retain a disposed provider instance. */
export function resetEmbeddingProvider(): void {
  cached = undefined;
}

/** Format a numeric vector as a pgvector literal: [v1,v2,...]. */
export function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}
