import { describe, expect, it } from "vitest";
import { DEFAULT_REDACTION_PATTERN, isRedacted, redact } from "../src/core";

describe("Redaction", () => {
  it("redacts keys matching the default pattern, case-insensitively", () => {
    for (const key of [
      "token",
      "API_SECRET",
      "Password",
      "authorization",
      "sessionId",
      "jwt",
      "apiKey",
    ]) {
      expect(isRedacted(key)).toBe(true);
    }
  });

  it("leaves other keys alone", () => {
    for (const key of ["theme", "locale", "cart"]) expect(isRedacted(key)).toBe(false);
    expect(redact("theme", "dark")).toBe("dark");
  });

  it("hides the value but keeps the fact it exists (name and length)", () => {
    const hidden = redact("authToken", "abc123secretvalue");
    expect(hidden).toBe("[redacted: 17 chars]");
    expect(hidden).not.toContain("abc123secretvalue");
  });

  it("accepts a custom pattern that replaces the default", () => {
    const pattern = /^ssn$/i;
    expect(isRedacted("ssn", pattern)).toBe(true);
    expect(isRedacted("token", pattern)).toBe(false);
    expect(redact("SSN", "123-45-6789", pattern)).not.toContain("123-45-6789");
  });

  it("is not affected by global or sticky pattern state", () => {
    const pattern = /token/g;
    expect(isRedacted("token", pattern)).toBe(true);
    expect(isRedacted("token", pattern)).toBe(true);
  });

  it("exposes the default pattern", () => {
    expect(DEFAULT_REDACTION_PATTERN.source).toBe("token|secret|password|auth|session|jwt|key");
  });

  it("never leaks a Redacted value in any output", () => {
    const entries = { sessionId: "s3cr3t-xyz", theme: "dark", apiKey: "k-999" };
    const out = JSON.stringify(
      Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, redact(k, v)])),
    );
    expect(out).not.toContain("s3cr3t-xyz");
    expect(out).not.toContain("k-999");
    expect(out).toContain("dark");
  });
});
