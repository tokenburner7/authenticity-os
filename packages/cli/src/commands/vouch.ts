/**
 * @auth/cli — `auth vouch` command
 *
 * Vouch for another identity.
 */

import { Command } from "commander";
import { vouchFor, type SignedCredential, type Identity } from "@auth/protocol";
import { loadStore, saveStore, type StoreData } from "../store.js";

export interface VouchOptions {
  target: string;
  evidence?: string;
  store: string;
}

export function vouchContent(opts: VouchOptions): SignedCredential {
  const data: StoreData = loadStore(opts.store);

  if (!data.identity) {
    throw new Error("No identity found. Run `auth identity create` first.");
  }

  const identity = data.identity as unknown as Identity;
  const credential = vouchFor(identity, opts.target, opts.evidence);

  data.credentials = [...(data.credentials ?? []), credential];
  saveStore(opts.store, data);

  // Also record the vouch in the reputation store for reputation tracking
  data.reputation = data.reputation ?? { vouches: [] };
  data.reputation.vouches = [
    ...(data.reputation.vouches ?? []),
    credential,
  ];
  saveStore(opts.store, data);

  return credential;
}

export const vouchCommand = new Command("vouch")
  .description("Vouch for another identity")
  .requiredOption("--target <id>", "Target identity ID to vouch for")
  .option("--evidence <evidence>", "Evidence URI or inline proof")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .action((opts: VouchOptions) => {
    try {
      const credential = vouchContent(opts);
      console.log(JSON.stringify(credential, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
