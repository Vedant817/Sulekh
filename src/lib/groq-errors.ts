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
