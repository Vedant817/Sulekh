/**
 * Groq SDK versions do not consistently expose `status`/`code` as top-level
 * properties, but they preserve the provider code in the serialized message.
 * Keep fallback detection limited to that explicit structured-output failure.
 */
export function isStructuredOutputValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; code?: unknown };
  return (
    candidate.code === "json_validate_failed" ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("json_validate_failed"))
  );
}

function readableRetryDelay(message: string): string | null {
  const raw = message.match(/Please try again in (.+?)\.\s*(?:Need more tokens|$)/i)?.[1];
  if (!raw) return null;

  const duration = raw.match(/^(?:(\d+)m)?([\d.]+)s$/i);
  if (!duration) return raw;
  const minutes = Number(duration[1] ?? 0);
  const seconds = Math.ceil(Number(duration[2]));
  return [minutes > 0 ? `${minutes}m` : null, seconds > 0 ? `${seconds}s` : null]
    .filter(Boolean)
    .join(" ");
}

/**
 * Convert Groq's verbose 429 payload into safe recovery guidance. Provider
 * messages include internal organization identifiers and billing links, so the
 * raw payload must not be persisted into a user-visible document error.
 */
export function formatGroqRateLimitError(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { message?: unknown; status?: unknown; code?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const isRateLimit =
    candidate.status === 429 ||
    candidate.code === "rate_limit_exceeded" ||
    message.includes('"code":"rate_limit_exceeded"') ||
    /rate limit reached/i.test(message);
  if (!isRateLimit) return null;

  const retryDelay = readableRetryDelay(message);
  return [
    "AI extraction is temporarily paused because the provider token limit was reached.",
    retryDelay ? `Retry in about ${retryDelay}.` : "Retry shortly.",
    "Your document is stored securely and does not need to be uploaded again.",
  ].join(" ");
}
