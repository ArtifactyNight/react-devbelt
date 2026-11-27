// @vitest-environment jsdom

import { beforeAll, beforeEach, expect, test, vi } from "vitest";

import {
  clearNetworkLog,
  formatAsCurl,
  formatAsFetch,
  formatEntryForAgent,
  getNetworkEntries,
  installNetworkLog,
  replayEntry,
} from "../src/core/network-log";

class FakeXhr extends EventTarget {
  status = 0;
  responseType: XMLHttpRequestResponseType = "";
  responseText = "";
  nextStatus = 201;
  hold = false;
  open() {}
  setRequestHeader(_name?: string, _value?: string) {}
  send() {
    if (this.hold) return;
    this.status = this.nextStatus;
    if (this.status !== 0) this.responseText = '{"id":7}';
    this.dispatchEvent(new Event("loadend"));
  }
  getAllResponseHeaders() {
    return "content-type: application/json\r\nx-request-id: abc\r\n";
  }
}

beforeAll(() => {
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  installNetworkLog();
});

beforeEach(() => clearNetworkLog());

function request(method: string, url: string, body?: string, status = 201) {
  const xhr = new XMLHttpRequest() as unknown as FakeXhr & XMLHttpRequest;
  xhr.nextStatus = status;
  xhr.open(method, url);
  xhr.setRequestHeader("Authorization", "Bearer secret-token-123456");
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(body);
}

test("records method, url, bodies, status and headers", () => {
  request("post", "https://api.test/api/v1/tickets?x=1", '{"title":"Hi"}');

  const [entry] = getNetworkEntries();
  expect(entry).toMatchObject({
    method: "POST",
    url: "https://api.test/api/v1/tickets?x=1",
    status: 201,
    requestBody: '{"title":"Hi"}',
    responseBody: '{"id":7}',
    responseHeaders: {
      "content-type": "application/json",
      "x-request-id": "abc",
    },
  });
  expect(entry.duration).toBeGreaterThanOrEqual(0);
});

test("masks the bearer token", () => {
  request("get", "https://api.test/me");
  expect(getNetworkEntries()[0].requestHeaders.Authorization).toBe(
    "Bearer …123456",
  );
});

test("lists newest first and clears", () => {
  request("get", "https://api.test/a");
  request("put", "https://api.test/b", "{}");
  expect(getNetworkEntries().map((e) => e.method)).toEqual(["PUT", "GET"]);
  clearNetworkLog();
  expect(getNetworkEntries()).toEqual([]);
});

test("a failed request has status 0 and no response body", () => {
  request("delete", "https://api.test/x", undefined, 0);
  const [entry] = getNetworkEntries();
  expect(entry.status).toBe(0);
  expect(entry.responseBody).toBeNull();
  expect(formatEntryForAgent(entry)).toContain("failed (no response");
});

const ALL = {
  url: true,
  request: true,
  response: true,
  headers: true,
  context: true,
};

test("formats a request as markdown an AI can read", () => {
  request("post", "https://api.test/api/v1/tickets", '{"a":1}');
  const text = formatEntryForAgent(getNetworkEntries()[0], ALL);

  expect(text).toMatch(/^## POST \/api\/v1\/tickets → 201\n/);
  expect(text).toContain("- **URL:** https://api.test/api/v1/tickets");
  expect(text).toMatch(/- \*\*Status:\*\* 201 Created \(\d+ ms\)/);
  expect(text).toMatch(/- \*\*Sent at:\*\* \d{4}-\d{2}-\d{2}T/);
  expect(text).toContain("- **Page:** http");
  expect(text).toMatch(/- \*\*Viewport:\*\* Full \d+×\d+/);
  expect(text).toContain(
    "### Request headers\n```http\nAuthorization: Bearer …123456",
  );
  expect(text).toContain('### Request body\n```json\n{\n  "a": 1\n}\n```');
  expect(text).toContain('### Response body\n```json\n{\n  "id": 7\n}\n```');
});

test("copy parts choose what ends up in the text", () => {
  request("post", "https://api.test/t", '{"a":1}');
  const entry = getNetworkEntries()[0];

  const bare = formatEntryForAgent(entry, {
    url: false,
    request: false,
    response: true,
    headers: false,
    context: false,
  });
  expect(bare).not.toContain("https://api.test/t");
  expect(bare).not.toContain("Request");
  expect(bare).not.toContain("Page:");
  expect(bare).not.toContain("Viewport:");
  expect(bare).toContain("### Response body");
  expect(bare).toMatch(/^## POST \/t → 201/);
});

test("a body containing code fences gets a longer fence", () => {
  request("post", "https://api.test/t", "```js\nalert(1)\n```");
  const text = formatEntryForAgent(getNetworkEntries()[0], ALL);
  expect(text).toContain("````text\n```js\nalert(1)\n```\n````");
});

test("long bodies are truncated with a note", () => {
  request("post", "https://api.test/t", "x".repeat(25_000));
  const text = formatEntryForAgent(getNetworkEntries()[0], ALL);
  expect(text).toContain("[truncated, 5000 more characters]");
});

test("a failed request says what the empty status means", () => {
  request("delete", "https://api.test/x", undefined, 0);
  const text = formatEntryForAgent(getNetworkEntries()[0], ALL);
  expect(text).toMatch(/^## DELETE \/x\n/);
  expect(text).toContain("failed (no response");
});

test("copies as cURL with a token placeholder and escaped quotes", () => {
  request("post", "https://api.test/t", `{"say":"it's"}`);
  const curl = formatAsCurl(getNetworkEntries()[0]);
  expect(curl).toBe(
    [
      "curl -X POST 'https://api.test/t' \\",
      "  -H 'Authorization: Bearer <TOKEN>' \\",
      "  -H 'Content-Type: application/json' \\",
      `  --data-raw '{"say":"it'\\''s"}'`,
    ].join("\n"),
  );
  request("get", "https://api.test/g");
  expect(formatAsCurl(getNetworkEntries()[0])).toMatch(
    /^curl 'https:\/\/api\.test\/g'/,
  );
});

test("copies as fetch", () => {
  request("put", "https://api.test/t", '{"a":1}');
  const code = formatAsFetch(getNetworkEntries()[0]);
  expect(code).toContain('await fetch("https://api.test/t", {');
  expect(code).toContain('method: "PUT"');
  expect(code).toContain('"Authorization": "Bearer <TOKEN>"');
  expect(code).toContain("body: JSON.stringify({");
});

test("replay sends the same request again and logs it", () => {
  request("patch", "https://api.test/t", '{"a":1}');
  replayEntry(getNetworkEntries()[0]);
  const [again, original] = getNetworkEntries();
  expect(again.id).not.toBe(original.id);
  expect(again).toMatchObject({
    method: "PATCH",
    url: "https://api.test/t",
    requestBody: '{"a":1}',
  });
});

test("the log survives a full reload and marks interrupted requests", async () => {
  vi.useFakeTimers();
  try {
    request("get", "https://api.test/done");
    const pending = new XMLHttpRequest() as unknown as FakeXhr & XMLHttpRequest;
    pending.hold = true;
    pending.open("POST", "https://api.test/inflight");
    pending.send("{}");
    expect(getNetworkEntries()[0].status).toBeNull();

    await vi.advanceTimersByTimeAsync(1_100);

    // A reload drops the in-memory state; sessionStorage still has the log.
    delete (window as unknown as Record<string, unknown>)["__devbeltStore:network"];
    const restored = getNetworkEntries();
    expect(restored.map((e) => [e.method, e.status])).toEqual([
      ["POST", 0],
      ["GET", 201],
    ]);
    expect(restored[1].responseBody).toBe('{"id":7}');
  } finally {
    vi.useRealTimers();
  }
});

test("clearing the log clears what was saved too", async () => {
  vi.useFakeTimers();
  try {
    request("get", "https://api.test/a");
    await vi.advanceTimersByTimeAsync(1_100);
    clearNetworkLog();
    await vi.advanceTimersByTimeAsync(1_100);
    delete (window as unknown as Record<string, unknown>)["__devbeltStore:network"];
    expect(getNetworkEntries()).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

test("leaving the page saves at once, without waiting for the delay", () => {
  request("get", "https://api.test/now");
  window.dispatchEvent(new Event("pagehide"));
  const saved = JSON.parse(window.sessionStorage.getItem("devbelt:network-log")!);
  expect(saved[0].url).toBe("https://api.test/now");
});

test("only the newest 100 requests are saved", async () => {
  vi.useFakeTimers();
  try {
    for (let i = 0; i < 120; i++) request("get", `https://api.test/${i}`);
    await vi.advanceTimersByTimeAsync(1_100);
    const saved = JSON.parse(window.sessionStorage.getItem("devbelt:network-log")!);
    expect(saved).toHaveLength(100);
    expect(saved[0].url).toBe("https://api.test/119");
    expect(getNetworkEntries()).toHaveLength(120);
  } finally {
    vi.useRealTimers();
  }
});

test("huge bodies are capped in memory", () => {
  request("post", "https://api.test/big", "x".repeat(1_200_000));
  const body = getNetworkEntries()[0].requestBody!;
  expect(body.length).toBeLessThan(1_100_000);
  expect(body).toContain("[truncated, 200000 more characters]");
});

test("fetch calls are logged with their bodies, and masked credentials", async () => {
  const original = window.fetch;
  window.fetch = (async () =>
    new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  // patch the stand-in, then restore it
  const key = "__devbeltFetchPatched";
  delete (window as unknown as Record<string, unknown>)[key];
  installNetworkLog();
  try {
    await window.fetch("https://api.test/f", {
      method: "post",
      headers: { Authorization: "Bearer secret-token-123456", "X-Id": "1" },
      body: '{"a":1}',
    });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    const [entry] = getNetworkEntries();
    expect(entry).toMatchObject({
      method: "POST",
      url: "https://api.test/f",
      status: 200,
      requestBody: '{"a":1}',
      responseBody: '{"ok":true}',
    });
    expect(entry.requestHeaders.authorization).toBe("Bearer …123456");
    expect(entry.requestHeaders["x-id"]).toBe("1");
  } finally {
    window.fetch = original;
    delete (window as unknown as Record<string, unknown>)[key];
  }
});

test("a replay leaves redacted headers out unless the app supplies them", () => {
  request("get", "https://api.test/r");
  const [entry] = getNetworkEntries();
  expect(entry.requestHeaders).toHaveProperty("Authorization");

  // what the replay's XHR is given, seen through the fake
  const sent: Record<string, string> = {};
  const original = FakeXhr.prototype.setRequestHeader;
  FakeXhr.prototype.setRequestHeader = function (name: string, value: string) {
    sent[name] = value;
  };
  try {
    replayEntry(entry);
    expect(sent).not.toHaveProperty("Authorization");
    expect(sent["Content-Type"]).toBe("application/json");

    installNetworkLog({ replayHeaders: () => "Bearer live-token" });
    replayEntry(entry);
    expect(sent.Authorization).toBe("Bearer live-token");
  } finally {
    FakeXhr.prototype.setRequestHeader = original;
    installNetworkLog({ replayHeaders: () => null });
  }
});
