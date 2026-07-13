/**
 * Groq counts the requested completion budget together with prompt tokens for
 * TPM enforcement. Keep each source slice comfortably below common 30k-token
 * limits; the SDK can then retry a later slice independently when an account's
 * rolling quota is temporarily exhausted.
 */
export const EXTRACTION_CHUNK_CHARS = 24_000;
export const MAX_EXTRACTION_TEXT_CHARS = 120_000;

export type ExtractionChunks = {
  chunks: string[];
  truncated: boolean;
};

/** Split at a nearby newline when possible so table rows are not cut in half. */
export function chunkExtractionText(text: string): ExtractionChunks {
  const truncated = text.length > MAX_EXTRACTION_TEXT_CHARS;
  const bounded = truncated ? text.slice(0, MAX_EXTRACTION_TEXT_CHARS) : text;
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < bounded.length) {
    const hardEnd = Math.min(cursor + EXTRACTION_CHUNK_CHARS, bounded.length);
    let end = hardEnd;

    if (hardEnd < bounded.length) {
      const newline = bounded.lastIndexOf("\n", hardEnd);
      // Avoid producing a tiny slice because of an unusually long line.
      if (newline > cursor + EXTRACTION_CHUNK_CHARS / 2) end = newline + 1;
    }

    const chunk = bounded.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    cursor = end;
  }

  return { chunks, truncated };
}
