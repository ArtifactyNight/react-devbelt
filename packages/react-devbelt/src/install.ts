import { installPlugins } from "./install-plugins";
import { defaultPlugins } from "./plugins";

// `import "react-devbelt/install"` is the zero-config form: the built-in plugins,
// installed before the app runs. The whole body sits behind one build-time
// condition, so a production build drops it and the plugins it pulls in.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  installPlugins(defaultPlugins());
}
