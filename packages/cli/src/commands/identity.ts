import { Command } from "commander";
import {
  createIdentity,
  toAnchor,
  type Identity,
  type AssuranceLevel,
} from "@auth/protocol";
import { loadStore, saveStore, type StoreData } from "../store.js";

const VALID_ASSURANCE: AssuranceLevel[] = [
  "peer",
  "social",
  "biometric",
  "government",
];

function parseAssurance(value: string): AssuranceLevel {
  if (!VALID_ASSURANCE.includes(value as AssuranceLevel)) {
    throw new Error(
      `Invalid assurance level "${value}". Must be one of: ${VALID_ASSURANCE.join(", ")}`
    );
  }
  return value as AssuranceLevel;
}

/**
 * `auth identity` — manage the local identity anchor.
 */
export const identityCommand = new Command("identity")
  .description("Manage the local identity anchor");

identityCommand
  .command("create")
  .description("Create a new identity anchor and save it to the store")
  .requiredOption("--handle <handle>", "Human-readable handle for the identity")
  .option("--store <path>", "Path to the store JSON file", "./.auth/store.json")
  .option(
    "--assurance <level>",
    "Assurance level (peer | social | biometric | government)",
    "peer"
  )
  .action((opts: { handle: string; store: string; assurance: string }) => {
    const assurance = parseAssurance(opts.assurance);
    const identity = createIdentity(opts.handle, assurance);

    const store = loadStore(opts.store);
    store.identity = {
      id: identity.id,
      handle: identity.handle,
      secretKey: identity.secretKey,
      assurance: identity.assurance,
      createdAt: identity.createdAt,
    };
    saveStore(opts.store, store);

    console.log("✓ Identity created and saved to", opts.store);
    console.log("  Handle:    ", identity.handle);
    console.log("  ID:        ", identity.id);
    console.log("  Assurance: ", identity.assurance);
    console.log("  Created:   ", identity.createdAt);
    console.log("");
    console.log("⚠  Keep your secret key safe. It is stored locally in plaintext.");
  });

identityCommand
  .command("show")
  .description("Display the identity anchor from the store")
  .option("--store <path>", "Path to the store JSON file", "./.auth/store.json")
  .action((opts: { store: string }) => {
    const store = loadStore(opts.store);
    if (!store.identity) {
      console.error("No identity found in store:", opts.store);
      console.error("Create one with: auth identity create --handle <handle>");
      process.exitCode = 1;
      return;
    }

    const stored = store.identity;
    const identity: Identity = {
      id: stored.id,
      handle: stored.handle,
      secretKey: stored.secretKey,
      assurance: stored.assurance as AssuranceLevel,
      createdAt: stored.createdAt,
    };
    const anchor = toAnchor(identity);

    console.log("Identity Anchor");
    console.log("  Handle:    ", anchor.handle);
    console.log("  ID:        ", anchor.id);
    console.log("  Assurance: ", anchor.assurance);
    console.log("  Created:   ", anchor.createdAt);
  });
