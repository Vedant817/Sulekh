/**
 * Deterministic text chunking for the regulatory corpus. Splits page text into
 * windows on paragraph boundaries, carrying forward the most recent detected
 * heading as a section tag, and records a resolvable source pointer (file +
 * page) on every chunk. No content is invented or summarised — chunks are
 * verbatim slices of the source (with a small overlap for retrieval continuity).
 */

export type Chunk = {
  content: string;
  sectionTag: string | null;
  sourceRef: string;
  chunkIndex: number;
  tokenCount: number;
};

export type ChunkOptions = {
  /** Approximate target characters per chunk (~4 chars/token). */
  targetChars?: number;
  /** Overlap characters prepended from the previous chunk. */
  overlapChars?: number;
  /** Label used in the source pointer (e.g. the file name). */
  sourceLabel: string;
};

const DEFAULTS = { targetChars: 1600, overlapChars: 200 };

/** ~4 characters per token is a stable, provider-agnostic approximation. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const HEADING_RE =
  /^(?:CHAPTER\b.*|PART\b.*|SCHEDULE\b.*|SECTION\b.*|ANNEXURE\b.*|Regulation\s+\d+.*|[A-Z][A-Z0-9 &,'()./-]{6,80})$/;

function detectHeading(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length < 4 || trimmed.length > 90) return null;
  if (!HEADING_RE.test(trimmed)) return null;
  if (/[.:;]$/.test(trimmed) && !/^(CHAPTER|PART|SCHEDULE|SECTION|ANNEXURE)/i.test(trimmed))
    return null;
  return trimmed;
}

function normalise(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

type Para = { text: string; heading: string | null; page: number };

/** First pass: flatten pages into paragraphs tagged with heading + page. */
function collectParagraphs(pages: string[]): Para[] {
  const paras: Para[] = [];
  let heading: string | null = null;
  for (let p = 0; p < pages.length; p++) {
    const lines = normalise(pages[p]).split("\n");
    let buffer: string[] = [];
    const flush = () => {
      const text = buffer.join(" ").trim();
      if (text) paras.push({ text, heading, page: p + 1 });
      buffer = [];
    };
    for (const line of lines) {
      const h = detectHeading(line);
      if (h) {
        flush();
        heading = h;
      } else if (line.trim() === "") {
        flush();
      } else {
        buffer.push(line.trim());
      }
    }
    flush();
  }
  return paras;
}

export function chunkPages(pages: string[], options: ChunkOptions): Chunk[] {
  const opts = { ...DEFAULTS, ...options };
  const paras = collectParagraphs(pages);

  // Second pass: pack paragraphs into windows (splitting over-long paragraphs).
  type Window = { text: string; heading: string | null; page: number };
  const windows: Window[] = [];
  let cur: Window | null = null;

  const pushCur = () => {
    if (cur && cur.text.trim()) windows.push({ ...cur, text: cur.text.trim() });
    cur = null;
  };

  for (const para of paras) {
    let text = para.text;
    // Split paragraphs longer than the target on sentence boundaries.
    while (text.length > opts.targetChars) {
      const slice = text.slice(0, opts.targetChars);
      const cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("; "));
      const at = cut > opts.targetChars * 0.5 ? cut + 1 : opts.targetChars;
      if (cur && cur.text.length + at > opts.targetChars) pushCur();
      if (!cur) cur = { text: "", heading: para.heading, page: para.page };
      cur.text += (cur.text ? " " : "") + text.slice(0, at).trim();
      pushCur();
      text = text.slice(at).trim();
    }
    if (cur && cur.text.length + text.length + 1 > opts.targetChars) pushCur();
    if (!cur) cur = { text: "", heading: para.heading, page: para.page };
    cur.text += (cur.text ? " " : "") + text;
  }
  pushCur();

  // Third pass: materialise chunks, prepending overlap from the previous window.
  return windows.map((w, i) => {
    const overlap =
      i > 0 && opts.overlapChars > 0
        ? windows[i - 1].text.slice(-opts.overlapChars) + " "
        : "";
    const content = (overlap + w.text).trim();
    return {
      content,
      sectionTag: w.heading,
      sourceRef: `${opts.sourceLabel} p.${w.page}`,
      chunkIndex: i,
      tokenCount: approxTokens(content),
    };
  });
}
