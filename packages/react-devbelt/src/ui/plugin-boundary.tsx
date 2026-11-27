"use client";

import { Component, type ReactNode } from "react";

type Props = { plugin: string; children: ReactNode };
type State = { failed: boolean };

/** A plugin that throws while rendering loses its own UI, not the toolbar's. */
export class PluginBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`devbelt: plugin "${this.props.plugin}" crashed`, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
