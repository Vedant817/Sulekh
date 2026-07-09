import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

/** A regulatory corpus source (see corpus/sources.json). */
export const corpusSourceSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["icdr", "sme_framework", "reference_drhp"]),
  file: z.string().min(1),
  url: z.string().url(),
  version: z.string().optional(),
  /** Required sources block ingest if absent (no invented content). */
  required: z.boolean().default(true),
});
export type CorpusSource = z.infer<typeof corpusSourceSchema>;

export const corpusManifestSchema = z.object({ sources: z.array(corpusSourceSchema).min(1) });
export type CorpusManifest = z.infer<typeof corpusManifestSchema>;

export const CORPUS_DIR = join(process.cwd(), "corpus");
export const MANIFEST_PATH = join(CORPUS_DIR, "sources.json");

export function loadManifest(): CorpusManifest {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return corpusManifestSchema.parse(JSON.parse(raw));
}

export function sourcePath(source: CorpusSource): string {
  return join(CORPUS_DIR, source.file);
}
