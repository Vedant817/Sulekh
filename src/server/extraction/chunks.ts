/**
 * Groq counts the requested completion budget together with prompt tokens for
 * TPM enforcement. Keep each source slice comfortably below common 30k-token
 * limits; the SDK can then retry a later slice independently when an account's
 * rolling quota is temporarily exhausted.
 */
export const EXTRACTION_CHUNK_CHARS = 24_000;
export const MAX_EXTRACTION_TEXT_CHARS = 120_000;
const RELEVANT_WINDOW_BEFORE_CHARS = 6_000;
const RELEVANT_WINDOW_AFTER_CHARS = 18_000;

const ENTITY_ANCHORS: Record<string, RegExp[]> = {
  financial_line_item: [
    /restated(?: consolidated)? statement of (?:assets and liabilities|profit and loss|cash flows?)/gi,
    /(?:balance sheet|statement of financial position|cash flow statement)/gi,
  ],
  cap_table_row: [
    /(?:pre-issue|post-issue) shareholding/gi,
    /shareholding pattern/gi,
    /capital structure/gi,
  ],
  litigation_item: [
    /outstanding litigations?/gi,
    /legal proceedings/gi,
    /(?:criminal|civil|tax) proceedings/gi,
    /material litigations?/gi,
  ],
  kmp_person: [
    /key managerial personnel/gi,
    /our management/gi,
    /brief profiles? of (?:our )?(?:directors|promoters)/gi,
  ],
};

export type ExtractionChunks = {
  chunks: string[];
  truncated: boolean;
};

type RelevantWindow = {
  start: number;
  end: number;
  anchorHits: number;
};

function entityRelevantText(text: string, entityType?: string): string {
  const anchors = entityType ? ENTITY_ANCHORS[entityType] : undefined;
  if (!anchors || anchors.length === 0) return text.slice(0, MAX_EXTRACTION_TEXT_CHARS);

  const positions = anchors.flatMap((pattern) =>
    [...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((match) => match.index),
  );
  if (positions.length === 0) return text.slice(0, MAX_EXTRACTION_TEXT_CHARS);

  const windows = positions
    .map((position): RelevantWindow => ({
      start: Math.max(0, position - RELEVANT_WINDOW_BEFORE_CHARS),
      end: Math.min(text.length, position + RELEVANT_WINDOW_AFTER_CHARS),
      anchorHits: 1,
    }))
    .sort((a, b) => a.start - b.start)
    .reduce<RelevantWindow[]>((merged, window) => {
      const previous = merged.at(-1);
      if (previous && window.start <= previous.end) {
        previous.end = Math.max(previous.end, window.end);
        previous.anchorHits += window.anchorHits;
      } else {
        merged.push({ ...window });
      }
      return merged;
    }, []);

  let remaining = MAX_EXTRACTION_TEXT_CHARS;
  const selected = windows
    .sort((a, b) => b.anchorHits - a.anchorHits || a.start - b.start)
    .flatMap((window) => {
      if (remaining <= 0) return [];
      const header = `--- Source excerpt near character ${window.start} ---\n`;
      const available = Math.max(0, remaining - header.length - 2);
      if (available === 0) return [];
      const end = Math.min(window.end, window.start + available);
      remaining -= header.length + (end - window.start) + 2;
      return [{ ...window, end, header }];
    })
    .sort((a, b) => a.start - b.start);

  return selected
    .map((window) => `${window.header}${text.slice(window.start, window.end)}`)
    .join("\n\n");
}

/** Split at a nearby newline when possible so table rows are not cut in half. */
export function chunkExtractionText(text: string, entityType?: string): ExtractionChunks {
  const truncated = text.length > MAX_EXTRACTION_TEXT_CHARS;
  const bounded = truncated ? entityRelevantText(text, entityType) : text;
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
