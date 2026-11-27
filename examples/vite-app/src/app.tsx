import { useState } from "react";

export function App() {
  const [status, setStatus] = useState("idle");

  const ok = async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/todos/1");
    setStatus(`GET ${res.status}`);
  };
  const bad = async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/nope/404", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer demo-token-abcdef" },
      body: JSON.stringify({ hello: "world" }),
    });
    setStatus(`POST ${res.status}`);
  };

  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 640 }}>
      <h1>devbelt · Vite</h1>
      <p>Press <kbd>2</kbd> for a phone frame, <kbd>G</kbd> to grab an element.</p>
      <p>
        <button onClick={ok}>Good request</button>{" "}
        <button onClick={bad}>Failing request</button>{" "}
        <button onClick={() => console.error("Something broke", new Error("boom"))}>
          console.error
        </button>
      </p>
      <p data-testid="status">last: {status}</p>
    </main>
  );
}
