import { definePlugin, useToolbar } from "react-devbelt";
import { text } from "react-devbelt/core";
import { chipClass } from "react-devbelt/ui";

const FACTS = [
  ["App", "devbelt kitchen sink"],
  ["Mode", import.meta.env.MODE],
  ["Base URL", import.meta.env.BASE_URL],
] as const;

function Window() {
  const toolbar = useToolbar();
  return (
    <div style={{ padding: 12, display: "grid", gap: 10, fontSize: 12 }}>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
        {FACTS.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt style={{ opacity: 0.6 }}>{label}</dt>
            <dd style={{ margin: 0 }}>{value}</dd>
          </div>
        ))}
      </dl>
      <p style={{ margin: 0, opacity: 0.7 }}>
        This window comes from a plugin written in the app with <code>definePlugin</code>.
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className={chipClass} onClick={() => toolbar.openWindow("network")}>
          Open Network
        </button>
        <button type="button" className={chipClass} onClick={() => toolbar.toggleWindow("console")}>
          Toggle Console
        </button>
      </div>
    </div>
  );
}

/** A small custom plugin: an Item with a window, a debug-bundle line and a read Agent tool. */
export function appInfo() {
  return definePlugin({
    id: "app-info",
    name: "App info",
    label: "App info",
    pinned: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
    window: {
      title: "App info",
      size: { width: 360, height: 220, minWidth: 260, minHeight: 160 },
      Component: Window,
    },
    debugContext: () => [{ label: "App", value: "devbelt kitchen sink" }],
    agentTools: [
      {
        name: "devbelt_app_info",
        description: "Which example app this is and how it was built.",
        inputSchema: { type: "object", properties: {} },
        annotations: { readOnlyHint: true },
        run: () => text(FACTS.map(([label, value]) => `${label}: ${value}`).join("\n")),
      },
    ],
  });
}
