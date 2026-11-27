import { Demo } from "./demo";

export default function Page() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 32, maxWidth: 640 }}>
      <h1>devbelt · Next.js</h1>
      <p>
        Press <kbd>2</kbd> for a phone frame, <kbd>G</kbd> to grab an element.
      </p>
      <Demo />
    </main>
  );
}
