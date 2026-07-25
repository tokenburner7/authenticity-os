import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 5174 },
  resolve: {
    alias: {
      "node:module": "/src/stubs/node-module.ts",
      "better-sqlite3": "/src/stubs/better-sqlite3.ts",
    },
  },
});