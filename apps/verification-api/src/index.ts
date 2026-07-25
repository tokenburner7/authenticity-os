#!/usr/bin/env node
/**
 * @auth/verification-api — entry point
 *
 * Opens or creates a SQLite database, seeds it with example identities and
 * credentials for demo purposes, then starts the Verification API server.
 *
 * Usage:
 *   npx tsx src/index.ts [--port=4001] [--db=./.auth/platform.db]
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  SqliteStore,
  createIdentity,
  attestCreation,
  vouchFor,
  contentHash,
  type Identity,
} from "@auth/protocol";
import { VerificationApiServer } from "./server.js";

// Parse CLI flags
function arg(name: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] ?? fallback : fallback;
}

const port = parseInt(arg("port", "4001"), 10);
const dbPath = arg("db", "./.auth/platform.db");

// Ensure the parent directory exists for the SQLite file
const dir = dirname(dbPath);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const store = new SqliteStore(dbPath);

/**
 * Seed the database with a few example identities and credentials.
 * Safe to call repeatedly — checks before inserting to avoid duplicates.
 */
function seed(store: SqliteStore): void {
  // Alice: a content creator with an established reputation
  let alice = store.loadIdentityByHandle("alice");
  if (!alice) {
    alice = createIdentity("alice", "social");
    store.saveIdentity(alice);
  }

  // Bob: a reviewer who vouches for Alice
  let bob = store.loadIdentityByHandle("bob");
  if (!bob) {
    bob = createIdentity("bob", "peer");
    store.saveIdentity(bob);
  }

  // Carol: another identity who vouches for Alice
  let carol = store.loadIdentityByHandle("carol");
  if (!carol) {
    carol = createIdentity("carol", "peer");
    store.saveIdentity(carol);
  }

  // Seed an example creation credential if none exists for Alice's demo content.
  const demoContent = "Hello world — this is Alice's first authenticated post.";
  const demoHash = contentHash(demoContent);
  const existingCred = store.loadCredentialByContentHash(demoHash);
  if (!existingCred) {
    const cred = attestCreation(alice as Identity, demoHash, "none", "demo-seed");
    store.saveCredential(cred);
    console.log(`Seeded creation credential for content hash ${demoHash.slice(0, 12)}…`);
  }

  // Seed vouches that build Alice's reputation.
  const existingVouches = store.getVouchesFor(alice.id);
  if (existingVouches.length === 0) {
    const v1 = vouchFor(bob as Identity, alice.id, "demo-seed");
    const v2 = vouchFor(carol as Identity, alice.id, "demo-seed");
    store.saveVouch(v1);
    store.saveVouch(v2);
    console.log("Seeded 2 vouches for alice.");
  }
}

void (async () => {
  seed(store);

  const server = new VerificationApiServer(store, { port });
  await server.start(port);

  console.log(`Platform verification API running on http://localhost:${port}`);
  console.log("Endpoints:");
  console.log("  GET  /health              — health check");
  console.log("  POST /verify              — verify a credential");
  console.log("  POST /verify-content      — verify content hash + signature");
  console.log("  GET  /credentials/:hash   — lookup credential by content hash");
  console.log("  GET  /reputation/:id      — get reputation for an identity");
  console.log("  POST /batch-verify        — batch-verify multiple credentials");
})();

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down verification API…");
  store.close();
  process.exit(0);
});
