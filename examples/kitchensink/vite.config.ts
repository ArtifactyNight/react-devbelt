import type { IncomingMessage, ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const todos = [
  { id: 1, title: "Open the Network window", done: true },
  { id: 2, title: "Frame the page at a phone size (key 2)", done: false },
  { id: 3, title: "Grab an element (key G)", done: false },
];

const json = (res: ServerResponse, status: number, body: unknown, delay = 0) =>
  setTimeout(() => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  }, delay);

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

/** A tiny offline API, so every Network and TanStack Query demo works without a network. */
function mockApi(): Plugin {
  return {
    name: "kitchensink-api",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/todos") return json(res, 200, todos);
        if (url.pathname === "/slow") return json(res, 200, { waited: "1.5s" }, 1500);
        if (url.pathname === "/fail") {
          return json(res, 500, { error: "Something went wrong", requestId: "req_7f3a" });
        }
        if (url.pathname === "/missing") return json(res, 404, { error: "Not found" });
        if (url.pathname === "/login" && req.method === "POST") {
          const body = await readBody(req);
          return json(res, 200, { ok: true, token: "demo-token-abcdef", received: body });
        }
        if (url.pathname === "/echo") {
          return json(res, 200, { method: req.method, body: await readBody(req) });
        }
        return json(res, 404, { error: `No mock for ${url.pathname}` });
      });
    },
  };
}

export default defineConfig({ plugins: [react(), mockApi()] });
