// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatStorageBundleSection,
  formatStorageForAgent,
  readStorageEntries,
} from "../src/core";

const clearCookies = () => {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearCookies();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearCookies();
});

describe("readStorageEntries", () => {
  it("lists entries from localStorage, sessionStorage and cookies, by store", () => {
    localStorage.setItem("theme", "dark");
    sessionStorage.setItem("step", "2");
    document.cookie = "locale=en; path=/";

    const entries = readStorageEntries();
    expect(entries).toEqual([
      { store: "localStorage", key: "theme", value: "dark", size: 4 },
      { store: "sessionStorage", key: "step", value: "2", size: 1 },
      { store: "cookies", key: "locale", value: "en", size: 2 },
    ]);
  });

  it("hides the toolbar's own devbelt:* keys", () => {
    localStorage.setItem("devbelt:layout", "{}");
    sessionStorage.setItem("devbelt:viewport", "x");
    localStorage.setItem("mine", "1");

    expect(readStorageEntries().map((e) => e.key)).toEqual(["mine"]);
  });
});

const SECRET = "eyJhbGciOi-very-secret";

describe("redaction", () => {
  beforeEach(() => {
    localStorage.setItem("authToken", SECRET);
    localStorage.setItem("theme", "dark");
    document.cookie = `session_id=${SECRET}; path=/`;
  });

  it("the agent view shows plain values but only name and length for redacted ones", () => {
    const out = formatStorageForAgent(readStorageEntries());
    expect(out).toContain("theme");
    expect(out).toContain("dark");
    expect(out).toContain("authToken");
    expect(out).toContain(`[redacted: ${SECRET.length} chars]`);
    expect(out).not.toContain(SECRET);
  });

  it("honours a custom redaction pattern", () => {
    const out = formatStorageForAgent(readStorageEntries(), { pattern: /theme/i });
    expect(out).not.toContain("dark");
    expect(out).toContain(SECRET);
  });

  it("the bundle section has key names and sizes, no values, by default", () => {
    const out = formatStorageBundleSection(readStorageEntries());
    expect(out).toContain("theme");
    expect(out).toContain("authToken");
    expect(out).toContain(String(SECRET.length));
    expect(out).not.toContain("dark");
    expect(out).not.toContain(SECRET);
  });

  it("includeValuesInBundle adds values, but redacted ones stay hidden", () => {
    const out = formatStorageBundleSection(readStorageEntries(), { includeValues: true });
    expect(out).toContain("dark");
    expect(out).toContain(`[redacted: ${SECRET.length} chars]`);
    expect(out).not.toContain(SECRET);
  });

  it("says plainly that HttpOnly cookies are invisible", () => {
    expect(formatStorageForAgent([])).toMatch(/HttpOnly cookies cannot be seen/);
  });
});
