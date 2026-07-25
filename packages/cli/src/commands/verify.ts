/**
 * @auth/cli — `auth verify` command
 *
 * Verify a credential's authenticity and issuer reputation.
 * Loads the credential from --file or from the database by --index,
 * builds an in-memory reputation store from the vouches saved in the DB,
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
import { CliDb } from "../db.js";

export interface VerifyOptions {
  file?: string;
  index: number;
  db: string;
  minReputation?: number;
}

/**
 * Build an in-memory reputation store from the vouches saved in the
 * local database, then verify the credential against it.
 */
function buildReputationStore(db: CliDb) {
  const repStore = createReputationStore();
  const vouches = db.getAllVouches();
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

  // For reputation lookups, open the DB once and reuse it.
  const db = opts.file ? undefined : new CliDb(opts.db);
  try {
    // Load credential from file or database
    if (opts.file) {
      const raw = readFileSync(opts.file, "utf-8");
      credential = JSON.parse(raw) as SignedCredential;
    } else {
      const credentials = db!.loadAllCredentials();
      if (credentials.length === 0) {
        throw new Error(
          "No credentials in database. Provide --file or run `auth attest` / `auth vouch` first.",
        );
      }
      if (opts.index < 0 || opts.index >= credentials.length) {
        throw new Error(
          `Credential index ${opts.index} out of range (0..${credentials.length - 1}).`,
        );
      }
      credential = credentials[opts.index];
    }

    // Build reputation store from DB vouches
    const repStore = db ? buildReputationStore(db) : createReputationStore();

    const result = verifyCredential(credential, repStore, {
      minReputation: opts.minReputation,
    });

    return result;
  } finally {
    db?.close();
  }
}

export const verifyCommand = new Command("verify")
  .description("Verify a credential's signature and issuer reputation")
  .option("--file <path>", "Credential JSON file to verify")
  .option("--index <n>", "Index into database credentials", "0")
  .option("--db <path>", "SQLite database file path", "./.auth/auth.db")
  .option("--min-reputation <score>", "Minimum reputation score (0-100)")
  .action((opts: { file?: string; index: string; db: string; minReputation?: string }) => {
    try {
      const result = verifyCredentialFlow({
        file: opts.file,
        index: parseInt(opts.index, 10),
        db: opts.db,
        minReputation: opts.minReputation ? parseInt(opts.minReputation, 10) : undefined,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
