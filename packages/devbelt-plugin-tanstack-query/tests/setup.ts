// jsdom has no matchMedia, which Torph reads to respect reduced motion. Answer "no preference".
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// ...nor the Web Animations API, which Torph uses to morph text. An animation that finishes at once.
if (typeof Element !== "undefined" && typeof Element.prototype.animate !== "function") {
  Element.prototype.animate = function () {
    const animation = {
      finished: Promise.resolve(),
      playState: "finished",
      onfinish: null,
      oncancel: null,
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      commitStyles() {},
      addEventListener() {},
      removeEventListener() {},
    };
    queueMicrotask(() => (animation.onfinish as (() => void) | null)?.());
    return animation as unknown as Animation;
  };
}

// Torph also watches sizes and reads running animations.
if (typeof Element !== "undefined" && typeof Element.prototype.getAnimations !== "function") {
  Element.prototype.getAnimations = () => [];
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
