import { listDocuments } from "@/server/extraction/documents";
import { listExtractedEntities } from "@/server/extraction/entities";
import {
  assessGenerationReadiness,
  type GenerationReadiness,
} from "@/server/generation/readiness-rules";
import { loadAnswers } from "@/server/intake/store";

export async function getGenerationReadiness(projectId: string): Promise<GenerationReadiness> {
  const [answers, documents, entities] = await Promise.all([
    loadAnswers(projectId),
    listDocuments(projectId),
    listExtractedEntities(projectId),
  ]);
  return assessGenerationReadiness({ answers, documents, entities });
}
