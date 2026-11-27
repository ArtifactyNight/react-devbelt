// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearStorageStore,
  deleteStorageEntry,
  readStorageEntries,
  setStorageEntry,
} from "../src/core";

const clearCookies = () => {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};
const reset = () => {
  localStorage.clear();
  sessionStorage.clear();
  clearCookies();
};
beforeEach(reset);
afterEach(reset);

describe("setStorageEntry", () => {
  it("edits or adds a value in each store", () => {
    localStorage.setItem("theme", "dark");
    setStorageEntry("localStorage", "theme", "light");
    setStorageEntry("sessionStorage", "step", "3");
    setStorageEntry("cookies", "locale", "th");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(sessionStorage.getItem("step")).toBe("3");
    expect(document.cookie).toContain("locale=th");
  });

  it("replaces a redacted value without reading it back", () => {
    localStorage.setItem("authToken", "old-secret");
    setStorageEntry("localStorage", "authToken", "new-secret");
    expect(localStorage.getItem("authToken")).toBe("new-secret");
  });

  it("refuses devbelt:* keys", () => {
    localStorage.setItem("devbelt:layout", "{}");
    expect(() => setStorageEntry("localStorage", "devbelt:layout", "x")).toThrow(/devbelt:/);
    expect(localStorage.getItem("devbelt:layout")).toBe("{}");
  });
});

describe("deleteStorageEntry", () => {
  it("removes one entry from each store", () => {
    localStorage.setItem("a", "1");
    sessionStorage.setItem("b", "2");
    document.cookie = "c=3; path=/";
    deleteStorageEntry("localStorage", "a");
    deleteStorageEntry("sessionStorage", "b");
    deleteStorageEntry("cookies", "c");
    expect(readStorageEntries()).toEqual([]);
  });

  it("deletes a redacted entry and refuses devbelt:* keys", () => {
    localStorage.setItem("authToken", "s");
    localStorage.setItem("devbelt:layout", "{}");
    deleteStorageEntry("localStorage", "authToken");
    expect(localStorage.getItem("authToken")).toBeNull();
    expect(() => deleteStorageEntry("localStorage", "devbelt:layout")).toThrow(/devbelt:/);
    expect(localStorage.getItem("devbelt:layout")).toBe("{}");
  });
});

describe("clearStorageStore", () => {
  it("empties a store but never touches devbelt:* keys", () => {
    localStorage.setItem("a", "1");
    localStorage.setItem("authToken", "s");
    localStorage.setItem("devbelt:layout", "{}");
    sessionStorage.setItem("b", "2");
    sessionStorage.setItem("devbelt:x", "y");
    document.cookie = "c=3; path=/";
    document.cookie = "devbelt:ck=1; path=/";

    clearStorageStore("localStorage");
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem("devbelt:layout")).toBe("{}");
    expect(sessionStorage.getItem("b")).toBe("2");

    clearStorageStore("sessionStorage");
    expect(sessionStorage.getItem("devbelt:x")).toBe("y");
    expect(sessionStorage.getItem("b")).toBeNull();

    clearStorageStore("cookies");
    expect(document.cookie).toContain("devbelt:ck=1");
    expect(document.cookie).not.toContain("c=3");
  });
});

it("refuses a cookie value that would add attributes", () => {
  expect(() => setStorageEntry("cookies", "a", "1; domain=x")).toThrow();
});
