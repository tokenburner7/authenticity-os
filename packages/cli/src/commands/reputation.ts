/**
 * @auth/cli — `auth reputation` command group
 *
 * `auth reputation show` — display reputation scores for an identity,
 * computed from the vouches saved in the local store.
 */

import { Command } from "commander";
import {
  createReputationStore,
  recordVouch,
  getReputation,
  type ReputationRecord,
  type SignedCredential,
} from "@auth/protocol";
import { loadStore, type StoreData } from "../store.js";

export interface ReputationShowOptions {
  identity: string;
  store: string;
}

/**
 * Core reputation-show logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function showReputation(opts: ReputationShowOptions): ReputationRecord | undefined {
  const data: StoreData = loadStore(opts.store);
  const vouches = (data.reputation?.vouches as SignedCredential[]) ?? [];

  const repStore = createReputationStore();
  for (const v of vouches) {
    recordVouch(repStore, v);
  }

  return getReputation(repStore, opts.identity);
}

export const reputationCommand = new Command("reputation").description(
  "View reputation scores computed from the local store",
);

reputationCommand
  .command("show")
  .description("Show reputation for an identity")
  .requiredOption("--identity <id>", "Identity ID (hex)")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .action((opts: ReputationShowOptions) => {
    try {
      const record = showReputation(opts);
      if (!record) {
        console.log(`No reputation record for identity ${opts.identity}.`);
        console.log(
          "Reputation is built from vouches. Run `auth vouch --target <id>` to vouch for someone.",
        );
        return;
      }
      console.log("Reputation Record");
      console.log("  Identity: ", record.identityId);
      console.log("  Overall:   ", record.overall);
      console.log("  Updated:   ", record.updatedAt);
      console.log("  Dimensions:");
      for (const d of record.dimensions) {
        console.log(
          `    ${d.dimension}: score=${d.score} sampleSize=${d.sampleSize} updatedAt=${d.updatedAt}`,
        );
      }
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
