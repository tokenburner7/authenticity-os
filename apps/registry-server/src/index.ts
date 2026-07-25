#!/usr/bin/env node
/**
 * Registry server entry point.
 * Run with: npx tsx src/index.ts --port 4000
 */

import { RegistryServer } from "./server.js";

const port = parseInt(process.argv.find(a => a.startsWith("--port="))?.split("=")[1] ?? "4000", 10);

const server = new RegistryServer();

server.start(port).then(() => {
  console.log(`Agent discovery registry running on http://localhost:${port}`);
  console.log("Endpoints:");
  console.log("  POST /register   — Register an agent");
  console.log("  GET  /agents      — List all agents");
  console.log("  GET  /agents/:id  — Lookup specific agent");
  console.log("  POST /unregister  — Remove an agent");
  console.log("  GET  /health      — Health check");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down registry server...");
  await server.stop();
  process.exit(0);
});
