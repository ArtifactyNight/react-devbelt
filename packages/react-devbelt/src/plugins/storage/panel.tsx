"use client";

import { useEffect, useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { CheckIcon, EyeIcon, EyeOffIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";

import { isRedacted, redact } from "../../core/redaction";
import { readString, writeString } from "../../core/storage";
import { pollCookiesWhileOpen, subscribeStorageChanges } from "../../core/storage-watch";
import {
  clearStorageStore,
  deleteStorageEntry,
  setStorageEntry,
  COOKIE_PATH_NOTE,
  HTTP_ONLY_NOTE,
  readStorageState,
  resolveStorageStores,
  STORAGE_STORES,
  type StorageEntry,
  type StorageStore,
} from "../../core/storage-view";
import { JsonCode } from "../../ui/json-code";
import { iconButtonClass, textButtonClass } from "../../ui/styles";

// List rows stay short. The detail starts clipped too, and Expand shows the rest.
const PREVIEW_CHARS = 80;
const DETAIL_CHARS = 240;

function preview(value: string): string {
  return value.length <= PREVIEW_CHARS ? value : `${value.slice(0, PREVIEW_CHARS)}…`;
}

const tabClass =
  "rounded-md px-2.5 py-1 text-fg-secondary hover:text-fg data-selected:bg-hover data-selected:text-fg focus-visible:outline-2 focus-visible:outline-focus";

function formatStorageValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function EntryDetail({
  entry,
  pattern,
  revealed,
}: {
  entry: StorageEntry;
  pattern?: RegExp;
  revealed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = isRedacted(entry.key, pattern) && !revealed;
  const full = hidden ? redact(entry.key, entry.value, pattern) : formatStorageValue(entry.value);
  const clipped = !hidden && !expanded && full.length > DETAIL_CHARS;
  const text = clipped ? `${full.slice(0, DETAIL_CHARS)}…` : full;
  return (
    <section aria-label={`Details for ${entry.key}`} className="mt-3 border-t border-line pt-3">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-semibold text-fg">{entry.key}</h3>
        {!hidden && full.length > DETAIL_CHARS ? (
          <Button
            aria-label={expanded ? "Collapse value" : "Expand value"}
            className={`${textButtonClass} text-fg-secondary`}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Collapse" : "Expand"}
          </Button>
        ) : null}
      </div>
      {hidden ? <p className="font-mono text-[11px] break-all text-fg-secondary">{text}</p> : <JsonCode code={text} />}
    </section>
  );
}

const TAB_KEY = "storage-tab";

function readSavedTab(enabled: readonly StorageStore[]): StorageStore {
  const saved = readString(TAB_KEY);
  if (
    (saved === "localStorage" || saved === "sessionStorage" || saved === "cookies") &&
    enabled.includes(saved)
  ) {
    return saved;
  }
  return enabled[0] ?? "localStorage";
}

const TITLE: Record<StorageStore, string> = {
  localStorage: "localStorage",
  sessionStorage: "sessionStorage",
  cookies: "Cookies",
};

/** The page's storage, one tab per enabled store, with edit, delete and clear. Redacted values show name and length only, and editing one starts blank. */
export function StoragePanel({
  pattern,
  stores = STORAGE_STORES,
}: {
  pattern?: RegExp;
  stores?: readonly StorageStore[];
}) {
  const enabled = resolveStorageStores(stores);
  const [state, setState] = useState(readStorageState);
  const [active, setActive] = useState<StorageStore>(() => readSavedTab(enabled));
  const { entries, unavailable } = state;
  // One Redacted value may be shown at a time. Never saved: it lives and dies with the open Window.
  const [revealed, setRevealed] = useState<{ store: StorageStore; key: string } | null>(null);
  const [confirming, setConfirming] = useState<StorageStore | null>(null);
  const [editing, setEditing] = useState<{ store: StorageStore; key: string; draft: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ store: StorageStore; key: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  useEffect(() => {
    const unsubscribe = subscribeStorageChanges(() => setState(readStorageState()));
    const stopPolling = pollCookiesWhileOpen();
    return () => {
      unsubscribe();
      stopPolling();
    };
  }, []);
  const store = enabled.includes(active) ? active : enabled[0];
  const refresh = () => setState(readStorageState());
  const selectStore = (value: StorageStore | null) => {
    if (!value || !enabled.includes(value) || value === store) return;
    setActive(value);
    writeString(TAB_KEY, value);
    setConfirming(null);
    setEditing(null);
    setSelected(null);
    setAdding(false);
    setNewKey("");
    setNewValue("");
  };
  const saveNew = () => {
    if (!store || newKey === "") return;
    attempt(() => {
      setStorageEntry(store, newKey, newValue);
      setAdding(false);
      setNewKey("");
      setNewValue("");
    });
  };
  const attempt = (change: () => void) => {
    try {
      change();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    refresh();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <p className="min-w-0 flex-1 text-fg-secondary">{HTTP_ONLY_NOTE}</p>
      </div>
      {error ? (
        <p role="alert" className="border-b border-line px-3 py-1 text-danger-fg">
          {error}
        </p>
      ) : null}
      {store ? (
      <Tabs value={store} onValueChange={selectStore} className="flex min-h-0 flex-1 flex-col">
        <TabsList aria-label="Stores" className="flex gap-1 border-b border-line px-2 py-1.5">
          {enabled.map((item) => (
            <TabsTab key={item} value={item} className={tabClass}>
              {TITLE[item]}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value={store} className="min-h-0 flex-1 scrollbar-slim overflow-auto p-3">
          {(() => {
          const all = entries.filter((e) => e.store === store);
          const needle = query.trim().toLowerCase();
          const list = needle ? all.filter((e) => e.key.toLowerCase().includes(needle)) : all;
          const section = (
            <section aria-label={TITLE[store]} className="mb-4">
              {store === "cookies" ? <p className="mb-2 text-fg-secondary">{COOKIE_PATH_NOTE}</p> : null}
              <Input
                aria-label="Filter entries"
                placeholder="Filter by key"
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                className="mb-2 h-7 w-full min-w-0 rounded-md border border-line bg-hover-subtle px-2 text-xs text-fg placeholder:text-fg-disabled focus-visible:outline-2 focus-visible:outline-focus"
              />
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-fg">
                  {TITLE[store]} <span className="tabular-nums text-fg-tertiary">{list.length}</span>
                </h3>
                {all.length > 0 && confirming === store ? (
                  <span className="ml-auto flex items-center gap-2 text-fg">
                    Clear all of {TITLE[store]}?
                    <Button
                      aria-label={`Confirm clearing ${TITLE[store]}`}
                      className={`${textButtonClass} text-danger-fg`}
                      onClick={() => {
                        setConfirming(null);
                        attempt(() => clearStorageStore(store));
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      aria-label={`Cancel clearing ${TITLE[store]}`}
                      className={`${textButtonClass} text-fg-secondary`}
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </Button>
                  </span>
                ) : all.length > 0 ? (
                  <Button
                    aria-label={`Clear ${TITLE[store]}`}
                    className={`${textButtonClass} ml-auto text-fg-secondary`}
                    onClick={() => setConfirming(store)}
                  >
                    Clear
                  </Button>
                ) : null}
                {unavailable[store] === undefined && !adding ? (
                  <Button aria-label="Add entry" className={`${textButtonClass} text-fg-secondary`} onClick={() => setAdding(true)}>
                    Add
                  </Button>
                ) : null}
              </div>
              {adding && unavailable[store] === undefined ? (
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Input
                    aria-label="New key"
                    placeholder="Key"
                    value={newKey}
                    onChange={(ev) => setNewKey(ev.target.value)}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line bg-hover-subtle px-2 text-xs text-fg"
                    autoFocus
                  />
                  <Input
                    aria-label="New value"
                    placeholder="Value"
                    value={newValue}
                    onChange={(ev) => setNewValue(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") saveNew();
                      if (ev.key === "Escape") setAdding(false);
                    }}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line bg-hover-subtle px-2 text-xs text-fg"
                  />
                  <Button aria-label="Save new entry" className={`${textButtonClass} text-fg`} onClick={saveNew}>
                    Save
                  </Button>
                  <Button
                    aria-label="Cancel new entry"
                    className={`${textButtonClass} text-fg-secondary`}
                    onClick={() => {
                      setAdding(false);
                      setNewKey("");
                      setNewValue("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
              {unavailable[store] !== undefined ? (
                <p role="status" className="text-warning-fg">
                  Unavailable: {unavailable[store]}. This is not an empty store.
                </p>
              ) : all.length === 0 ? (
                <p className="text-fg-tertiary">Empty.</p>
              ) : list.length === 0 ? (
                <p className="text-fg-tertiary">No matches.</p>
              ) : (
                <dl className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto_auto] gap-x-3 gap-y-1 font-mono text-[11px]">
                  {list.map((e) => {
                    const hidden = isRedacted(e.key, pattern);
                    const isRevealed = hidden && revealed?.store === e.store && revealed.key === e.key;
                    const isEditing = editing?.store === e.store && editing.key === e.key;
                    const save = () =>
                      attempt(() => {
                        setStorageEntry(e.store, e.key, editing!.draft);
                        setEditing(null);
                      });
                    return (
                      <div key={e.key} className="contents">
                        <dt className="truncate" title={e.key}>
                          <Button
                            aria-pressed={selected?.store === e.store && selected.key === e.key}
                            className={`${textButtonClass} max-w-full truncate text-fg`}
                            onClick={() =>
                              setSelected(
                                selected?.store === e.store && selected.key === e.key
                                  ? null
                                  : { store: e.store, key: e.key },
                              )
                            }
                          >
                            {e.key}
                          </Button>
                        </dt>
                        <dd className="m-0 break-all text-fg-secondary">
                          {isEditing ? (
                            <Input
                              aria-label={`Value for ${e.key}`}
                              placeholder={isRedacted(e.key, pattern) ? "New value (current is hidden)" : ""}
                              value={editing.draft}
                              onChange={(ev) => setEditing({ ...editing, draft: ev.target.value })}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") save();
                                if (ev.key === "Escape") setEditing(null);
                              }}
                              autoFocus
                            />
                          ) : hidden && !isRevealed ? (
                            redact(e.key, e.value, pattern)
                          ) : (
                            preview(e.value)
                          )}
                        </dd>
                        <dd className="m-0 tabular-nums text-fg-tertiary">{e.size}</dd>
                        <dd className="m-0 flex gap-1">
                          {isEditing ? (
                            <>
                              <Button aria-label={`Save ${e.key}`} className={iconButtonClass} onClick={save}>
                                <CheckIcon className="size-3.5" aria-hidden="true" />
                              </Button>
                              <Button
                                aria-label={`Cancel editing ${e.key}`}
                                className={iconButtonClass}
                                onClick={() => setEditing(null)}
                              >
                                <XIcon className="size-3.5" aria-hidden="true" />
                              </Button>
                            </>
                          ) : (
                            <>
                              {hidden ? (
                                <Button
                                  aria-label={`${isRevealed ? "Hide" : "Reveal"} ${e.key}`}
                                  className={iconButtonClass}
                                  onClick={() => setRevealed(isRevealed ? null : { store: e.store, key: e.key })}
                                >
                                  {isRevealed ? (
                                    <EyeOffIcon className="size-3.5" aria-hidden="true" />
                                  ) : (
                                    <EyeIcon className="size-3.5" aria-hidden="true" />
                                  )}
                                </Button>
                              ) : null}
                            <Button
                              aria-label={`Edit ${e.key}`}
                              className={iconButtonClass}
                              onClick={() =>
                                setEditing({
                                  store: e.store,
                                  key: e.key,
                                  // A Redacted value is never put in the field.
                                  draft: isRedacted(e.key, pattern) ? "" : e.value,
                                })
                              }
                            >
                              <PencilIcon className="size-3.5" aria-hidden="true" />
                            </Button>
                            </>
                          )}
                          <Button
                            aria-label={`Delete ${e.key}`}
                            className={iconButtonClass}
                            onClick={() => attempt(() => deleteStorageEntry(e.store, e.key))}
                          >
                            <Trash2Icon className="size-3.5" aria-hidden="true" />
                          </Button>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              )}
            </section>
          );
          const open =
            selected?.store === store
              ? entries.find((entry) => entry.store === store && entry.key === selected.key)
              : undefined;
          return (
            <>
              {section}
              {open ? (
                <EntryDetail
                  entry={open}
                  pattern={pattern}
                  revealed={revealed?.store === open.store && revealed.key === open.key}
                />
              ) : null}
            </>
          );
          })()}
        </TabsPanel>
      </Tabs>
      ) : (
        <p className="p-3 text-fg-tertiary">No stores are enabled.</p>
      )}
    </div>
  );
}
