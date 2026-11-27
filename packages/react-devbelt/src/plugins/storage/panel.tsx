"use client";

import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { Input } from "@ui-sdk/react/input";
import { CheckIcon, PencilIcon, RefreshCwIcon, Trash2Icon, XIcon } from "lucide-react";

import { isRedacted, redact } from "../../core/redaction";
import {
  clearStorageStore,
  deleteStorageEntry,
  setStorageEntry,
  HTTP_ONLY_NOTE,
  readStorageEntries,
  STORAGE_STORES,
  type StorageStore,
} from "../../core/storage-view";
import { iconButtonClass } from "../../ui/styles";

const TITLE: Record<StorageStore, string> = {
  localStorage: "localStorage",
  sessionStorage: "sessionStorage",
  cookies: "Cookies",
};

/** The page's storage, grouped by store, with edit, delete and clear. Redacted values show name and length only, and editing one starts blank. */
export function StoragePanel({ pattern }: { pattern?: RegExp }) {
  // Storage has no change event for the same tab, so the list is a snapshot
  // that the refresh button retakes.
  const [entries, setEntries] = useState(readStorageEntries);
  const [editing, setEditing] = useState<{ store: StorageStore; key: string; draft: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => setEntries(readStorageEntries());
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
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <p className="min-w-0 flex-1 text-white/60">{HTTP_ONLY_NOTE}</p>
        <Button
          aria-label="Refresh storage"
          className={iconButtonClass}
          onClick={refresh}
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      {error ? (
        <p role="alert" className="border-b border-white/10 px-3 py-1 text-red-300">
          {error}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {STORAGE_STORES.map((store) => {
          const list = entries.filter((e) => e.store === store);
          return (
            <section key={store} aria-label={TITLE[store]} className="mb-4">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="font-semibold text-white">
                  {TITLE[store]} <span className="tabular-nums text-white/50">{list.length}</span>
                </h3>
                {list.length > 0 ? (
                  <Button
                    aria-label={`Clear ${TITLE[store]}`}
                    className="ml-auto text-white/70"
                    onClick={() => attempt(() => clearStorageStore(store))}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              {list.length === 0 ? (
                <p className="text-white/50">Empty.</p>
              ) : (
                <dl className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] gap-x-3 gap-y-1 font-mono text-[11px]">
                  {list.map((e) => {
                    const isEditing = editing?.store === e.store && editing.key === e.key;
                    const save = () =>
                      attempt(() => {
                        setStorageEntry(e.store, e.key, editing!.draft);
                        setEditing(null);
                      });
                    return (
                      <div key={e.key} className="contents">
                        <dt className="truncate text-white" title={e.key}>
                          {e.key}
                        </dt>
                        <dd className="m-0 break-all text-white/70">
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
                          ) : (
                            redact(e.key, e.value, pattern)
                          )}
                        </dd>
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
        })}
      </div>
    </div>
  );
}
