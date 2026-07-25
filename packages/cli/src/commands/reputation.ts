/**
 * @auth/cli — `auth reputation` command group
 *
 * `auth reputation show` — display reputation scores for an identity,
 * computed from the vouches saved in the local database.
 */

import { Command } from "commander";
import {
  createReputationStore,
  recordVouch,
  getReputation,
  type ReputationRecord,
} from "@auth/protocol";
import { CliDb } from "../db.js";

export interface ReputationShowOptions {
  identity: string;
  db: string;
}

/**
 * Core reputation-show logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function showReputation(opts: ReputationShowOptions): ReputationRecord | undefined {
  const db = new CliDb(opts.db);
  try {
    const vouches = db.getAllVouches();

    const repStore = createReputationStore();
    for (const v of vouches) {
      recordVouch(repStore, v);
    }

    return getReputation(repStore, opts.identity);
  } finally {
    db.close();
  }
}

export const reputationCommand = new Command("reputation").description(
  "View reputation scores computed from the local database",
);

reputationCommand
  .command("show")
  .description("Show reputation for an identity")
  .requiredOption("--identity <id>", "Identity ID (hex)")
  .option("--db <path>", "SQLite database file path", "./.auth/auth.db")
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
