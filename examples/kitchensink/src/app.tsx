import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Todo = { id: number; title: string; done: boolean };

const STRINGS = {
  en: { title: "Kitchen sink", lead: "Every devbelt plugin, with something to poke at." },
  th: { title: "ครัวครบเครื่อง", lead: "ทุกปลั๊กอินของ devbelt พร้อมของให้ลองกด" },
} as const;

function readLang(): keyof typeof STRINGS {
  const match = document.cookie.match(/(?:^|; )lang=([^;]*)/);
  return match?.[1] === "th" ? "th" : "en";
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      <div className="row">{children}</div>
    </section>
  );
}

const getJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

function NetworkDemo() {
  const [last, setLast] = useState("nothing yet");
  const call = async (label: string, run: () => Promise<Response>) => {
    setLast(`${label}…`);
    try {
      const res = await run();
      setLast(`${label} → ${res.status}`);
    } catch (error) {
      setLast(`${label} failed: ${String(error)}`);
    }
  };
  const xhr = () => {
    const request = new XMLHttpRequest();
    request.open("GET", "/api/todos");
    request.onload = () => setLast(`XHR → ${request.status}`);
    request.send();
  };

  return (
    <Section
      title="Network"
      hint="Open Network (the tree icon). The Authorization header is masked; open a row to see bodies, copy it as cURL or replay it."
    >
      <button onClick={() => call("GET todos", () => fetch("/api/todos"))}>GET 200</button>
      <button onClick={() => call("GET slow", () => fetch("/api/slow"))}>Slow (1.5s)</button>
      <button
        onClick={() =>
          call("POST login", () =>
            fetch("/api/login", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: "Bearer demo-token-abcdef",
              },
              body: JSON.stringify({ user: "ada", password: "hunter2" }),
            }),
          )
        }
      >
        POST with a token
      </button>
      <button onClick={() => call("GET missing", () => fetch("/api/missing"))}>404</button>
      <button onClick={() => call("GET fail", () => fetch("/api/fail"))}>500</button>
      <button onClick={() => call("GET offline", () => fetch("http://localhost:1/nope"))}>
        Network error
      </button>
      <button onClick={xhr}>XHR</button>
      <output data-testid="network-status">last: {last}</output>
    </Section>
  );
}

function ConsoleDemo() {
  return (
    <Section
      title="Console"
      hint="Open Console (the bug icon) to filter by level. Recent errors also go into Copy debug bundle."
    >
      <button onClick={() => console.log("Hello from the kitchen sink", { at: Date.now() })}>log</button>
      <button onClick={() => console.info("Something worth knowing")}>info</button>
      <button onClick={() => console.warn("This looks suspicious")}>warn</button>
      <button onClick={() => console.error("Something broke", new Error("boom"))}>error</button>
      <button
        onClick={() => {
          void Promise.reject(new Error("Unhandled rejection"));
        }}
      >
        unhandled rejection
      </button>
      <button
        onClick={() => {
          setTimeout(() => {
            throw new Error("Uncaught error");
          });
        }}
      >
        uncaught error
      </button>
    </Section>
  );
}

function StorageDemo() {
  const [count, setCount] = useState(0);
  const seed = () => {
    const n = count + 1;
    setCount(n);
    localStorage.setItem("theme", n % 2 ? "dark" : "light");
    localStorage.setItem("recent-searches", JSON.stringify(["query", "storage", `try ${n}`]));
    localStorage.setItem("auth-token", "eyJhbGciOi.demo.signature"); // redacted by key name
    sessionStorage.setItem("wizard-step", String(n));
    document.cookie = `visited=${n}; path=/`;
    document.cookie = `session-id=abc123${n}; path=/`; // redacted by key name
  };
  return (
    <Section
      title="Storage"
      hint="Open Storage (the database icon). Values whose key looks secret stay hidden until revealed. The window updates as the page writes."
    >
      <button onClick={seed}>Write some values</button>
      <button
        onClick={() => {
          localStorage.removeItem("theme");
          sessionStorage.removeItem("wizard-step");
        }}
      >
        Remove two
      </button>
      <output>writes: {count}</output>
    </Section>
  );
}

function QueryDemo() {
  const queryClient = useQueryClient();
  const todos = useQuery({ queryKey: ["todos"], queryFn: () => getJson("/api/todos") as Promise<Todo[]> });
  const slow = useQuery({ queryKey: ["slow"], queryFn: () => getJson("/api/slow"), enabled: false });
  const broken = useQuery({ queryKey: ["broken", { page: 1 }], queryFn: () => getJson("/api/fail") });
  const save = useMutation({
    mutationKey: ["save-todo"],
    mutationFn: async (title: string) => {
      const res = await fetch("/api/echo", { method: "POST", body: JSON.stringify({ title }) });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  return (
    <Section
      title="TanStack Query"
      hint="Open TanStack Query. Queries show their status and fetch count; refetch, invalidate or reset one from its row. The failing query is on purpose."
    >
      <button onClick={() => void slow.refetch()}>Fetch the slow query</button>
      <button onClick={() => void queryClient.invalidateQueries({ queryKey: ["todos"] })}>
        Invalidate todos
      </button>
      <button onClick={() => save.mutate(`Todo ${Date.now() % 1000}`)}>Run a mutation</button>
      <output>
        todos: {todos.status} ({todos.data?.length ?? 0}) · slow: {slow.status} · broken:{" "}
        {broken.status} · mutation: {save.status}
      </output>
    </Section>
  );
}

function BreakpointDemo() {
  return (
    <Section
      title="Breakpoints"
      hint="The toolbar shows the current breakpoint (md · 812px). Frame the page at a phone, iPad or MacBook size and watch the grid change; toggle the outline to see boxes."
    >
      <div className="cards" style={{ width: "100%" }}>
        {["One", "Two", "Three", "Four", "Five", "Six"].map((name) => (
          <article key={name} className="card">
            <h3>{name}</h3>
            <p>Columns: 1 below md, 2 from md, 3 from lg.</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

export function App() {
  const text = STRINGS[readLang()];
  return (
    <main className="page">
      <h1>{text.title}</h1>
      <p className="lead">{text.lead}</p>
      <p className="hint">
        Press <kbd>2</kbd>–<kbd>6</kbd> for a device frame, <kbd>1</kbd> for the full page, <kbd>G</kbd> to grab
        an element. Open the <b>⋯</b> menu to pin tools, reset the layout, or switch tools between windows and
        popovers (or load <code>?panel=popover</code>). Dark mode and the language switch are in Display.
      </p>
      <NetworkDemo />
      <ConsoleDemo />
      <StorageDemo />
      <QueryDemo />
      <BreakpointDemo />
    </main>
  );
}
