import { createSqlClient } from "../db/client";
import {
  getEmbeddingProvider,
  toPgVector,
} from "../src/server/retrieval/embeddings";

/**
 * Populate embeddings for corpus chunks that don't yet have one. Idempotent:
 * re-runs only touch null-embedding rows (never re-chunks or duplicates).
 * Fails loudly on any provider/HTTP error.
 */
async function main() {
  const provider = getEmbeddingProvider();
  const sql = createSqlClient();
  try {
    const [{ count: pending }] = await sql<{ count: number }[]>`
      select count(*)::int as count from public.corpus_chunks where embedding is null`;
    if (pending === 0) {
      console.log("✔ All corpus chunks already embedded — nothing to do.");
      return;
    }
    console.log(
      `Embedding ${pending} chunk(s) via ${provider.name}/${provider.model} (dim ${provider.dim})…`,
    );

    let done = 0;
    // Pull and embed in provider-sized batches until none remain.
    for (;;) {
      const rows = await sql<{ id: string; content: string }[]>`
        select id, content from public.corpus_chunks
        where embedding is null
        order by document_id, chunk_index
        limit ${provider.batchSize}`;
      if (rows.length === 0) break;

      const vectors = await provider.embed(
        rows.map((r) => r.content),
        "RETRIEVAL_DOCUMENT",
      );

      await sql.begin(async (tx) => {
        for (let i = 0; i < rows.length; i++) {
          await tx`update public.corpus_chunks
                   set embedding = ${toPgVector(vectors[i])}::vector
                   where id = ${rows[i].id}`;
        }
      });

      done += rows.length;
      process.stdout.write(`\r  embedded ${done}/${pending}`);
    }
    process.stdout.write("\n");
    console.log("✔ Embeddings complete.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("✖ Embedding failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
