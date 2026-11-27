"use client";

import { useState } from "react";

export function Demo() {
  const [status, setStatus] = useState("idle");
  return (
    <p>
      <button
        onClick={async () => {
          const res = await fetch("/api/hello");
          setStatus(`GET ${res.status}`);
        }}
      >
        Good request
      </button>{" "}
      <button
        onClick={async () => {
          const res = await fetch("/api/missing", {
            method: "POST",
            headers: { authorization: "Bearer demo-token-abcdef" },
            body: JSON.stringify({ hello: "world" }),
          });
          setStatus(`POST ${res.status}`);
        }}
      >
        Failing request
      </button>{" "}
      <button onClick={() => console.error("Something broke", new Error("boom"))}>
        console.error
      </button>{" "}
      <span data-testid="status">last: {status}</span>
    </p>
  );
}
