import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createSqlClient } from "../client";
import { parsePdf } from "../../src/server/extraction/parse";
import { chunkPages } from "../../src/server/retrieval/chunking";
import { loadManifest, sourcePath, type CorpusSource } from "../../src/server/retrieval/corpus";

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

async function ingestSource(
  sql: ReturnType<typeof createSqlClient>,
  source: CorpusSource,
  data: Buffer,
): Promise<{ chunks: number; skipped: boolean }> {
  const checksum = sha256(data);

  // Read the prior state BEFORE upserting so we can detect an unchanged source.
  const prior = await sql<{ id: string; checksum: string | null; chunk_count: number }[]>`
    select d.id, d.checksum,
           (select count(*)::int from public.corpus_chunks c where c.document_id = d.id) as chunk_count
    from public.corpus_documents d where d.source_key = ${source.key}`;

  // Upsert the document row (keyed by source_key).
  const [doc] = await sql<{ id: string }[]>`
    insert into public.corpus_documents (source_key, title, source_type, version, uri, checksum)
    values (${source.key}, ${source.title}, ${source.type}, ${source.version ?? null},
            ${source.url}, ${checksum})
    on conflict (source_key) do update
      set title = excluded.title, source_type = excluded.source_type,
          version = excluded.version, uri = excluded.uri, checksum = excluded.checksum
    returning id`;

  // Idempotent: unchanged content + chunks already present => nothing to do.
  if (prior[0] && prior[0].checksum === checksum && prior[0].chunk_count > 0) {
    return { chunks: prior[0].chunk_count, skipped: true };
  }

  const { pages } = await parsePdf(new Uint8Array(data));
  const chunks = chunkPages(pages, { sourceLabel: source.file });
  if (chunks.length === 0) {
    throw new Error(`No extractable text in ${source.file} (scanned PDF? OCR is a v2 path).`);
  }

  // Replace chunks for this document (deterministic re-ingest).
  await sql`delete from public.corpus_chunks where document_id = ${doc.id}`;
  const BATCH = 250;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH).map((c) => ({
      document_id: doc.id,
      chunk_index: c.chunkIndex,
      content: c.content,
      section_tag: c.sectionTag,
      source_ref: c.sourceRef,
      token_count: c.tokenCount,
    }));
    await sql`insert into public.corpus_chunks ${sql(batch)}`;
  }

  return { chunks: chunks.length, skipped: false };
}

async function main() {
  const { sources } = loadManifest();

  // Fail honestly if a required source file is absent — never invent content.
  const missingRequired = sources.filter((s) => s.required && !existsSync(sourcePath(s)));
  if (missingRequired.length) {
    console.error("✖ Missing required corpus source file(s):");
    for (const s of missingRequired) {
      console.error(`  - ${s.file}  (fetch: pnpm corpus:fetch, or place manually)  <- ${s.url}`);
    }
    process.exitCode = 1;
    return;
  }

  const sql = createSqlClient();
  try {
    let totalChunks = 0;
    let totalDocs = 0;
    for (const source of sources) {
      const path = sourcePath(source);
      if (!existsSync(path)) {
        console.warn(`• skip   ${source.file} (optional, not present)`);
        continue;
      }
      process.stdout.write(`• ingest ${source.file} (${source.type}) ... `);
      const data = readFileSync(path);
      const { chunks, skipped } = await ingestSource(sql, source, data);
      console.log(`${chunks} chunk(s)${skipped ? " (unchanged, skipped)" : ""}`);
      totalChunks += chunks;
      totalDocs += 1;
    }
    console.log(`\n✔ Corpus ingested: ${totalDocs} document(s), ${totalChunks} chunk(s).`);
    console.log("  Embeddings are populated separately (pnpm seed:corpus is chunk-only).");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("✖ Corpus ingest failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
