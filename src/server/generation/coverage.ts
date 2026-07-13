/**
 * Grounding verification. The model is instructed to (a) emit `[[GAP: …]]`
 * markers instead of inventing unknowns, and (b) self-report which requirement
 * codes it addressed. Neither is trusted: this module independently parses gap
 * markers and checks, against the actual section text, whether each requirement
 * the model claims to have covered is really present — catching over-claims.
 */

export type CoverageStatus = "covered" | "partial" | "missing";

export type RequirementRef = {
  code: string;
  title: string;
  mandatory: boolean;
};

export type CoverageResult = {
  code: string;
  claimedByModel: boolean;
  present: boolean;
  status: CoverageStatus;
  /** True when the model claimed coverage the text does not support. */
  overclaimed: boolean;
};

const GAP_RE = /\[\[GAP:\s*([^\]]*?)\s*\]\]/gi;

/** Extract the messages inside `[[GAP: …]]` markers. */
export function parseGapMarkers(text: string): string[] {
  const gaps: string[] = [];
  for (const m of text.matchAll(GAP_RE)) gaps.push(m[1].trim());
  return gaps;
}

/** Text with gap markers removed — used so a topic mentioned only inside a GAP
 * does not count as "covered". */
export function stripGapMarkers(text: string): string {
  return text.replace(GAP_RE, " ");
}

const STOPWORDS = new Set([
  "the", "and", "for", "of", "a", "an", "to", "in", "on", "by", "or", "with",
  "issue", "issuer", "company", "details", "other", "our", "its", "per",
]);

/** Significant lowercased keywords from a requirement title. */
export function keywords(title: string): string[] {
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s&/-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
    ),
  );
}

/**
 * Independently assess coverage of each requirement against the section text.
 * `covered` = most keywords present in non-gap text; `partial` = some; `missing`
 * = none (or the topic appears only inside a GAP marker).
 */
export function checkCoverage(
  sectionMarkdown: string,
  requirements: RequirementRef[],
  claimedCodes: string[],
): CoverageResult[] {
  const claimed = new Set(claimedCodes);
  const hasUnresolvedGaps = parseGapMarkers(sectionMarkdown).length > 0;
  const haystack = stripGapMarkers(sectionMarkdown).toLowerCase();

  return requirements.map((req) => {
    const kws = keywords(req.title);
    const hits = kws.filter((k) => haystack.includes(k)).length;
    const ratio = kws.length === 0 ? 0 : hits / kws.length;

    let present: boolean;
    let status: CoverageStatus;
    if (ratio >= 0.5) {
      present = true;
      status = hasUnresolvedGaps ? "partial" : "covered";
    } else if (ratio > 0) {
      present = true;
      status = "partial";
    } else {
      present = false;
      status = "missing";
    }

    return {
      code: req.code,
      claimedByModel: claimed.has(req.code),
      present,
      status,
      // The model said it covered this, but the text doesn't substantively show it.
      overclaimed: claimed.has(req.code) && status === "missing",
    };
  });
}
