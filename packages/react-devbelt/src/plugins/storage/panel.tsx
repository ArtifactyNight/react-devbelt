"use client";

import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import { RefreshCwIcon } from "lucide-react";

import { redact } from "../../core/redaction";
import {
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

/** Read-only list of the page's storage, grouped by store. Redacted values show name and length only. */
export function StoragePanel({ pattern }: { pattern?: RegExp }) {
  // Storage has no change event for the same tab, so the list is a snapshot
  // that the refresh button retakes.
  const [entries, setEntries] = useState(readStorageEntries);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <p className="min-w-0 flex-1 text-white/60">{HTTP_ONLY_NOTE}</p>
        <Button
          aria-label="Refresh storage"
          className={iconButtonClass}
          onClick={() => setEntries(readStorageEntries())}
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {STORAGE_STORES.map((store) => {
          const list = entries.filter((e) => e.store === store);
          return (
            <section key={store} aria-label={TITLE[store]} className="mb-4">
              <h3 className="mb-1 font-semibold text-white">
                {TITLE[store]} <span className="tabular-nums text-white/50">{list.length}</span>
              </h3>
              {list.length === 0 ? (
                <p className="text-white/50">Empty.</p>
              ) : (
                <dl className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-[11px]">
                  {list.map((e) => (
                    <div key={e.key} className="contents">
                      <dt className="truncate text-white" title={e.key}>
                        {e.key}
                      </dt>
                      <dd className="m-0 break-all text-white/70">{redact(e.key, e.value, pattern)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
