"use client";

import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  NumberInput,
  NumberInputControl,
  NumberInputGroup,
} from "@ui-sdk/react/number-input";
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";

import { CUSTOM_SIZE_LIMITS } from "../../core/viewports";
import { patchDisplay, presetOf, selectViewport, useViewportState } from "../viewport/store";

export type LocaleOptions = {
  /** Name of the cookie the app reads its language from. */
  cookie: string;
  /** Language codes the switch offers, e.g. `["en", "th"]`. */
  options: readonly string[];
  /** Used when the cookie is missing or not one of `options`. Default: the first option. */
  default?: string;
};

export function readLocale(locale: LocaleOptions): string {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${locale.cookie.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );
  const value = match ? decodeURIComponent(match[1]) : null;
  return value && locale.options.includes(value)
    ? value
    : (locale.default ?? locale.options[0]);
}

export function writeLocale(locale: LocaleOptions, value: string) {
  document.cookie = `${locale.cookie}=${encodeURIComponent(value)}; path=/; max-age=31536000`;
}

const rowClass = "flex items-center justify-between gap-3 py-1.5";
const switchClass =
  "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-track p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-checked:bg-inverse data-disabled:opacity-40";
const thumbClass =
  "block size-4 rounded-full bg-inverse shadow transition-transform data-checked:translate-x-4 data-checked:bg-surface";
const sizeInputClass =
  "h-7 w-full min-w-0 rounded-md border border-line-strong bg-hover-subtle px-2 text-xs text-fg tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-focus";

export function DisplayPanel({
  locale: localeOptions,
  darkClass,
  onLocale,
}: {
  locale?: LocaleOptions;
  darkClass: string | false;
  onLocale: (value: string) => void;
}) {
  const state = useViewportState();
  const { display } = state;
  const framed = Boolean(presetOf(state));
  const onChange = patchDisplay;
  const onCustomSize = (patch: Parameters<typeof patchDisplay>[0]) => {
    patchDisplay(patch);
    selectViewport("custom");
  };
  const [locale, setLocale] = useState(() =>
    localeOptions ? readLocale(localeOptions) : "",
  );

  return (
    <div className="min-h-0 flex-1 scrollbar-slim overflow-auto p-3">
      <label className={rowClass}>
        <span>
          Rotate
          <span className="block text-fg-tertiary">
            {framed ? "Swap width and height" : "Pick a device first"}
          </span>
        </span>
        <Switch
          checked={display.rotated}
          disabled={!framed}
          onCheckedChange={(rotated) => onChange({ rotated })}
          className={switchClass}
        >
          <SwitchThumb className={thumbClass} />
        </Switch>
      </label>

      {darkClass ? (
      <label className={rowClass}>
        Dark mode
        <Switch
          checked={display.dark}
          onCheckedChange={(dark) => onChange({ dark })}
          className={switchClass}
        >
          <SwitchThumb className={thumbClass} />
        </Switch>
      </label>
      ) : null}

      <label className={rowClass}>
        <span>
          Grab includes errors
          <span className="block text-fg-tertiary">
            Recent console errors and failed requests
          </span>
        </span>
        <Switch
          checked={display.attachProblems}
          onCheckedChange={(attachProblems) => onChange({ attachProblems })}
          className={switchClass}
        >
          <SwitchThumb className={thumbClass} />
        </Switch>
      </label>

      {localeOptions ? (
      <div className={rowClass}>
        <span id="devbelt-language-label">Language</span>
        <SegmentedControl
          aria-labelledby="devbelt-language-label"
          value={locale}
          onValueChange={(next) => {
            if (!next || next === locale) return;
            setLocale(next);
            onLocale(next);
          }}
          className="relative isolate inline-flex rounded-md border border-line-strong p-0.5"
        >
          <SegmentedControlIndicator className="pointer-events-none absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) z-0 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded bg-inverse transition-[top,left,width,height] duration-200" />
          {localeOptions.options.map((code) => (
            <SegmentedControlItem
              key={code}
              value={code}
              className="relative z-10 min-w-10 rounded px-2.5 py-1 text-xs font-medium uppercase outline-none focus-visible:outline-2 focus-visible:outline-focus data-checked:text-fg-inverse"
            >
              {code}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      ) : null}

      <div className="mt-1 border-t border-line pt-2">
        <p className="mb-1.5 text-fg-secondary">Custom size (key 6)</p>
        <div className="flex items-center gap-2">
          <NumberInput
            {...CUSTOM_SIZE_LIMITS}
            value={display.customWidth}
            onValueChange={(next) => {
              if (next != null) onCustomSize({ customWidth: next });
            }}
            className="min-w-0 flex-1"
          >
            <NumberInputGroup>
              <NumberInputControl
                aria-label="Custom width"
                className={sizeInputClass}
              />
            </NumberInputGroup>
          </NumberInput>
          <span aria-hidden="true" className="text-fg-tertiary">
            ×
          </span>
          <NumberInput
            {...CUSTOM_SIZE_LIMITS}
            value={display.customHeight}
            onValueChange={(next) => {
              if (next != null) onCustomSize({ customHeight: next });
            }}
            className="min-w-0 flex-1"
          >
            <NumberInputGroup>
              <NumberInputControl
                aria-label="Custom height"
                className={sizeInputClass}
              />
            </NumberInputGroup>
          </NumberInput>
        </div>
        <Button
          className="mt-2 inline-flex h-7 w-full items-center justify-center rounded-md border border-line-strong font-medium hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus"
          onClick={() => onCustomSize({})}
        >
          Use custom size
        </Button>
      </div>
    </div>
  );
}
