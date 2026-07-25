/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..", "..");

/**
 * Stub out Node-only modules that the protocol barrel transitively imports
 * (via SqliteStore -> `node:module` -> better-sqlite3). The widget never uses
 * SqliteStore, so we redirect the Node builtins / native deps to a tiny
 * shim that throws if anything actually tries to use them at runtime.
 */
function nodeStubs(): Plugin {
  const stub = resolve(root, "apps/widget/src/stubs/node-module.ts");
  const map: Record<string, string> = {
    "node:module": stub,
    "better-sqlite3": stub,
  };
  return {
    name: "auth-widget-node-stubs",
    enforce: "pre",
    resolveId(source) {
      if (map[source]) return map[source];
      return null;
    },
  };
}

export default defineConfig({
  server: { port: 5174 },
  resolve: {
    alias: {
      // Import the TypeScript sources directly so Vite bundles the pure-JS
      // protocol in the browser (same approach as the demo app).
      "@auth/protocol": resolve(root, "packages/protocol/src/index.ts"),
    },
  },
  plugins: [nodeStubs()],
  build: {
    lib: {
      entry: resolve(root, "apps/widget/src/widget.ts"),
      name: "AuthBadge",
      formats: ["iife"],
      fileName: () => "auth-badge.js",
    },
    rollupOptions: {
      output: { exports: "named" },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    alias: [
      {
        find: "@auth/protocol",
        replacement: resolve(root, "packages/protocol/src/index.ts"),
      },
    ],
  },
});
