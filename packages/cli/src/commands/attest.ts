/**
 * @auth/cli — `auth attest` command
 *
 * Attest content creation with your identity.
 * Loads identity from store, hashes content, calls attestCreation,
 * saves the credential, and prints it.
 */

import { Command } from "commander";
import {
  contentHash,
  attestCreation,
  type AIAssistanceLevel,
  type SignedCredential,
  type Identity,
} from "@auth/protocol";
import { loadStore, saveStore, type StoreData } from "../store.js";

const VALID_AI_LEVELS: AIAssistanceLevel[] = [
  "none",
  "partial",
  "ai-assisted",
  "fully-ai",
];

export interface AttestOptions {
  content: string;
  aiAssistance: string;
  evidence?: string;
  store: string;
}

/**
 * Core attestation logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function attestContent(opts: AttestOptions): SignedCredential {
  const data: StoreData = loadStore(opts.store);

  if (!data.identity) {
    throw new Error("No identity found. Run `auth identity create` first.");
  }

  if (!VALID_AI_LEVELS.includes(opts.aiAssistance as AIAssistanceLevel)) {
    throw new Error(
      `Invalid AI assistance level "${opts.aiAssistance}". Must be one of: ${VALID_AI_LEVELS.join(", ")}`,
    );
  }

  const identity = data.identity as unknown as Identity;
  const hash = contentHash(opts.content);
  const credential = attestCreation(
    identity,
    hash,
    opts.aiAssistance as AIAssistanceLevel,
    opts.evidence,
  );

  data.credentials = [...(data.credentials ?? []), credential];
  saveStore(opts.store, data);

  return credential;
}

export const attestCommand = new Command("attest")
  .description("Attest content creation with your identity")
  .requiredOption("--content <content>", "Content to attest")
  .option(
    "--ai-assistance <level>",
    "AI assistance level (none|partial|ai-assisted|fully-ai)",
    "none",
  )
  .option("--evidence <evidence>", "Evidence URI or inline proof")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .action((opts: AttestOptions) => {
    try {
      const credential = attestContent(opts);
      console.log(JSON.stringify(credential, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
