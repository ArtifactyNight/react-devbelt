"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@ui-sdk/react/button";
import {
  NumberInput,
  NumberInputControl,
  NumberInputGroup,
} from "@ui-sdk/react/number-input";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";

import { CUSTOM_SIZE_LIMITS } from "../../core/viewports";
import { spring } from "../../ui/springs";
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
  "relative inline-flex h-5 w-9 shrink-0 items-center after:absolute after:inset-x-0 after:-inset-y-0.5 rounded-full bg-track p-0.5 transition-colors duration-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-checked:bg-inverse data-disabled:opacity-40";
const thumbClass =
  "block size-4 rounded-full bg-inverse shadow data-checked:bg-surface";

/** A switch whose thumb glides on a transform spring. */
function MotionSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={switchClass}
    >
      <SwitchThumb
        className={thumbClass}
        render={
          <motion.span
            initial={false}
            animate={{ x: checked ? 16 : 0 }}
            transition={spring.moderate}
          />
        }
      />
    </Switch>
  );
}
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
        <MotionSwitch
          checked={display.rotated}
          disabled={!framed}
          onCheckedChange={(rotated) => onChange({ rotated })}
        />
      </label>

      {darkClass ? (
      <label className={rowClass}>
        Dark mode
        <MotionSwitch
          checked={display.dark}
          onCheckedChange={(dark) => onChange({ dark })}
        />
      </label>
      ) : null}

      <label className={rowClass}>
        <span>
          Grab includes errors
          <span className="block text-fg-tertiary">
            Recent console errors and failed requests
          </span>
        </span>
        <MotionSwitch
          checked={display.attachProblems}
          onCheckedChange={(attachProblems) => onChange({ attachProblems })}
        />
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
          {localeOptions.options.map((code) => (
            <SegmentedControlItem
              key={code}
              value={code}
              className="relative z-10 min-w-10 rounded px-2.5 py-1 text-xs font-medium uppercase outline-none focus-visible:outline-2 focus-visible:outline-focus data-checked:text-fg-inverse"
            >
              {locale === code ? (
                <motion.span
                  layoutId="devbelt-locale-pill"
                  aria-hidden="true"
                  transition={spring.moderate}
                  className="pointer-events-none absolute inset-0 -z-10 rounded bg-inverse"
                />
              ) : null}
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
