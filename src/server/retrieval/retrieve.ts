import type { Sql } from "postgres";

import {
  getEmbeddingProvider,
  toPgVector,
  type EmbeddingProvider,
} from "@/server/retrieval/embeddings";

/**
 * Retrieval Service. For a DRHP section it returns:
 *   1. the authoritative governing requirements from the seeded checklist
 *      (each with a source citation) — always available; and
 *   2. the top-k most relevant corpus passages via pgvector cosine similarity
 *      (grounding text with a resolvable source pointer) — requires embeddings.
 *
 * Functions take an injected `Sql` client so they are unit/integration testable
 * and free of server-only imports; callers pass `getSql()`.
 */

export type SectionRequirement = {
  code: string;
  title: string;
  description: string | null;
  mandatory: boolean;
  citation: string;
  ordinal: number;
};

export type CorpusPassage = {
  chunkId: string;
  content: string;
  sectionTag: string | null;
  sourceRef: string;
  documentTitle: string;
  documentType: string;
  similarity: number;
};

export type SectionRetrieval = {
  sectionKey: string;
  sectionTitle: string;
  requirements: SectionRequirement[];
  passages: CorpusPassage[];
  /** True when embeddings were available and a vector search ran. */
  passagesFromVectorSearch: boolean;
};

/** Authoritative governing requirements for a section (checklist-derived). */
export async function getSectionRequirements(
  sql: Sql,
  sectionKey: string,
): Promise<SectionRequirement[]> {
  const rows = await sql<
    {
      code: string;
      title: string;
      description: string | null;
      mandatory: boolean;
      source_citation: string;
      ordinal: number;
    }[]
  >`
    select code, title, description, mandatory, source_citation, ordinal
    from public.requirement_checklist
    where section_key = ${sectionKey}
    order by ordinal`;
  return rows.map((r) => ({
    code: r.code,
    title: r.title,
    description: r.description,
    mandatory: r.mandatory,
    citation: r.source_citation,
    ordinal: r.ordinal,
  }));
}

async function getSectionTitle(sql: Sql, sectionKey: string): Promise<string> {
  const rows = await sql<{ title: string }[]>`
    select title from public.drhp_section_catalog where section_key = ${sectionKey}`;
  if (rows.length === 0) throw new Error(`Unknown section: ${sectionKey}`);
  return rows[0].title;
}

/** Cosine-similarity search over embedded corpus chunks. */
export async function searchCorpus(
  sql: Sql,
  queryVector: number[],
  opts: { k?: number; sourceTypes?: string[]; embeddingSignature?: string } = {},
): Promise<CorpusPassage[]> {
  const k = opts.k ?? 8;
  const vec = toPgVector(queryVector);
  const types = opts.sourceTypes ?? null;
  const rows = await sql<
    {
      chunk_id: string;
      content: string;
      section_tag: string | null;
      source_ref: string;
      document_title: string;
      document_type: string;
      similarity: number;
    }[]
  >`
    select c.id as chunk_id, c.content, c.section_tag, c.source_ref,
           d.title as document_title, d.source_type as document_type,
           1 - (c.embedding <=> ${vec}::vector) as similarity
    from public.corpus_chunks c
    join public.corpus_documents d on d.id = c.document_id
    where c.embedding is not null
      ${opts.embeddingSignature ? sql`and c.embedding_signature = ${opts.embeddingSignature}` : sql``}
      ${types ? sql`and d.source_type = any(${types})` : sql``}
    order by c.embedding <=> ${vec}::vector
    limit ${k}`;
  return rows.map((r) => ({
    chunkId: r.chunk_id,
    content: r.content,
    sectionTag: r.section_tag,
    sourceRef: r.source_ref,
    documentTitle: r.document_title,
    documentType: r.document_type,
    similarity: Number(r.similarity),
  }));
}

/** Build the retrieval query text for a section from its requirements. */
function buildQuery(sectionTitle: string, requirements: SectionRequirement[]): string {
  const reqs = requirements
    .map((r) => `${r.title}: ${r.description ?? ""}`)
    .join(" ");
  return `SME DRHP disclosure requirements for the section "${sectionTitle}". ${reqs}`.trim();
}

/**
 * Full retrieval for a section: governing requirements + top-k grounding
 * passages. If no chunks are embedded yet, requirements are still returned and
 * `passagesFromVectorSearch` is false (never a fabricated passage).
 */
export async function retrieveForSection(
  sql: Sql,
  sectionKey: string,
  opts: { k?: number; sourceTypes?: string[]; provider?: EmbeddingProvider } = {},
): Promise<SectionRetrieval> {
  const [sectionTitle, requirements] = await Promise.all([
    getSectionTitle(sql, sectionKey),
    getSectionRequirements(sql, sectionKey),
  ]);

  const provider = opts.provider ?? getEmbeddingProvider();
  const [{ count: embedded }] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.corpus_chunks
    where embedding is not null and embedding_signature = ${provider.signature}`;

  let passages: CorpusPassage[] = [];
  let passagesFromVectorSearch = false;
  if (embedded > 0) {
    const [queryVector] = await provider.embed(
      [buildQuery(sectionTitle, requirements)],
      "RETRIEVAL_QUERY",
    );
    passages = await searchCorpus(sql, queryVector, {
      k: opts.k,
      sourceTypes: opts.sourceTypes,
      embeddingSignature: provider.signature,
    });
    passagesFromVectorSearch = true;
  }

  return { sectionKey, sectionTitle, requirements, passages, passagesFromVectorSearch };
}
