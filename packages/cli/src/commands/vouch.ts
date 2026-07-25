/**
 * @auth/cli — `auth vouch` command
 *
 * Vouch for another identity. Loads your identity from the store,
 * calls vouchFor, saves the credential and the vouch record.
 */

import { Command } from "commander";
import {
  vouchFor,
  type Identity,
  type SignedCredential,
} from "@auth/protocol";
import { loadStore, saveStore, type StoreData } from "../store.js";

export interface VouchOptions {
  target: string;
  evidence?: string;
  store: string;
}

/**
 * Core vouch logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function vouchForTarget(opts: VouchOptions): SignedCredential {
  const data: StoreData = loadStore(opts.store);

  if (!data.identity) {
    throw new Error("No identity found. Run `auth identity create` first.");
  }

  const identity = data.identity as unknown as Identity;
  const credential = vouchFor(identity, opts.target, opts.evidence);

  // Save credential to store.credentials
  data.credentials = [...(data.credentials ?? []), credential];

  // Save vouch to store.reputation.vouches
  data.reputation = {
    vouches: [...((data.reputation?.vouches as SignedCredential[]) ?? []), credential],
  };

  saveStore(opts.store, data);

  return credential;
}

export const vouchCommand = new Command("vouch")
  .description("Vouch for another identity")
  .requiredOption("--target <id>", "Target identity ID (hex)")
  .option("--evidence <evidence>", "Evidence URI or inline proof")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .action((opts: VouchOptions) => {
    try {
      const credential = vouchForTarget(opts);
      console.log(JSON.stringify(credential, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
