/**
 * @auth/cli — `auth verify` command
 *
 * Verify a credential's authenticity and issuer reputation.
 * Loads the credential from --file or from the store by --index,
 * builds an in-memory reputation store from store.reputation.vouches,
 * calls verifyCredential, and prints the result.
 */

import { Command } from "commander";
import { readFileSync } from "node:fs";
import {
  verifyCredential,
  createReputationStore,
  recordVouch,
  type SignedCredential,
  type VerificationResult,
} from "@auth/protocol";
import { loadStore, type StoreData } from "../store.js";

export interface VerifyOptions {
  file?: string;
  index: number;
  store: string;
  minReputation?: number;
}

/**
 * Build an in-memory reputation store from the vouches saved in the
 * local store, then verify the credential against it.
 */
function buildReputationStore(data: StoreData) {
  const repStore = createReputationStore();
  const vouches = (data.reputation?.vouches as SignedCredential[]) ?? [];
  for (const v of vouches) {
    recordVouch(repStore, v);
  }
  return repStore;
}

/**
 * Core verification logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function verifyCredentialFlow(opts: VerifyOptions): VerificationResult {
  let credential: SignedCredential | undefined;

  // Load credential from file or store
  if (opts.file) {
    const raw = readFileSync(opts.file, "utf-8");
    credential = JSON.parse(raw) as SignedCredential;
  } else {
    const data: StoreData = loadStore(opts.store);
    const credentials = (data.credentials as SignedCredential[]) ?? [];
    if (credentials.length === 0) {
      throw new Error(
        "No credentials in store. Provide --file or run `auth attest` / `auth vouch` first.",
      );
    }
    if (opts.index < 0 || opts.index >= credentials.length) {
      throw new Error(
        `Credential index ${opts.index} out of range (0..${credentials.length - 1}).`,
      );
    }
    credential = credentials[opts.index];
  }

  // Build reputation store from store vouches
  const data: StoreData = opts.file ? {} : loadStore(opts.store);
  const repStore = buildReputationStore(data);

  const result = verifyCredential(credential, repStore, {
    minReputation: opts.minReputation,
  });

  return result;
}

export const verifyCommand = new Command("verify")
  .description("Verify a credential's signature and issuer reputation")
  .option("--file <path>", "Credential JSON file to verify")
  .option("--index <n>", "Index into store credentials", "0")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .option("--min-reputation <score>", "Minimum reputation score (0-100)")
  .action((opts: { file?: string; index: string; store: string; minReputation?: string }) => {
    try {
      const result = verifyCredentialFlow({
        file: opts.file,
        index: parseInt(opts.index, 10),
        store: opts.store,
        minReputation: opts.minReputation ? parseInt(opts.minReputation, 10) : undefined,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
