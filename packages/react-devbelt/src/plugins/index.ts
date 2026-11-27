import type { DevBeltPlugin } from "../plugin";
import { bundle } from "./bundle";
import { consolePlugin } from "./console";
import { display } from "./display";
import { grab } from "./grab";
import { network } from "./network";
import { viewport } from "./viewport";

export { bundle } from "./bundle";
export { breakpoint, type BreakpointOptions } from "./breakpoint";
export { consolePlugin } from "./console";
export { display, type DisplayOptions } from "./display";
export { grab, setGrabbing } from "./grab";
export { network } from "./network";
export { storage, type StorageOptions } from "./storage";
export { viewport } from "./viewport";
export {
  switcher,
  type SwitcherConfig,
  type SwitcherOption,
} from "./switcher";

/** Viewport, Grab, Network, Console, Display and Copy debug bundle, in toolbar order. */
export function defaultPlugins(): DevBeltPlugin[] {
  return [viewport(), grab(), network(), consolePlugin(), bundle(), display()];
}
