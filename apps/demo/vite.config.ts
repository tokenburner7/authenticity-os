import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/**
 * Stub out Node-only modules that the protocol barrel transitively imports
 * (via SqliteStore -> `node:module` -> better-sqlite3). The demo never uses
 * SqliteStore, so we redirect the Node builtins / native deps to a tiny
 * shim that throws if anything actually tries to use them at runtime.
 */
function nodeStubs(): Plugin {
  const stub = resolve(root, "apps/demo/src/stubs/node-module.ts");
  const map: Record<string, string> = {
    "node:module": stub,
    "better-sqlite3": stub,
  };
  return {
    name: "auth-demo-node-stubs",
    enforce: "pre",
    resolveId(source) {
      if (map[source]) return map[source];
      return null;
    },
  };
}

export default defineConfig({
  server: { port: 5173 },
  resolve: {
    alias: {
      // Import the TypeScript sources directly so Vite bundles the pure-JS
      // protocol in the browser. We deliberately do NOT alias @auth/agent
      // here — it depends on better-sqlite3 / ws / node:http which don't
      // exist in the browser. The demo reimplements the agent message-bus
      // logic inline (see src/scenario.ts) using only @auth/protocol.
      "@auth/protocol": resolve(root, "packages/protocol/src/index.ts"),
    },
  },
  plugins: [nodeStubs()],
});
