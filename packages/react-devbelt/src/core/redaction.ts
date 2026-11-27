// Redaction hides a secret's value while keeping the fact that it exists (the
// key name and the value's length). The Toolbar, Agent tools and Debug bundle
// all go through here, so no Plugin re-implements it.
export const DEFAULT_REDACTION_PATTERN = /token|secret|password|auth|session|jwt|key/i;

/** Whether the value stored under `key` must be Redacted. */
export function isRedacted(key: string, pattern: RegExp = DEFAULT_REDACTION_PATTERN): boolean {
  // Global and sticky patterns carry `lastIndex` between calls; reset so the
  // answer depends only on the key.
  pattern.lastIndex = 0;
  const hit = pattern.test(key);
  pattern.lastIndex = 0;
  return hit;
}

/** The hidden form of a value: its length only, never its content. */
export const redactedForm = (value: string): string => `[redacted: ${value.length} chars]`;

/** `value` unchanged, or its hidden form when `key` is Redacted. */
export function redact(key: string, value: string, pattern?: RegExp): string {
  return isRedacted(key, pattern) ? redactedForm(value) : value;
}
