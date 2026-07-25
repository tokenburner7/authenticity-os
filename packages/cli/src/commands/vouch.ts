/**
 * @auth/cli — `auth vouch` command
 *
 * Vouch for another identity. Loads your identity from the database,
 * calls vouchFor, and saves the vouch credential.
 */

import { Command } from "commander";
import {
  vouchFor,
  type SignedCredential,
} from "@auth/protocol";
import { CliDb } from "../db.js";

export interface VouchOptions {
  target: string;
  evidence?: string;
  db: string;
}

/**
 * Core vouch logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function vouchForTarget(opts: VouchOptions): SignedCredential {
  const db = new CliDb(opts.db);
  try {
    const identity = db.loadIdentity();

    if (!identity) {
      throw new Error("No identity found. Run `auth identity create` first.");
    }

    const credential = vouchFor(identity, opts.target, opts.evidence);

    // saveVouch stores it as a credential of type 'vouch'; getVouchesFor
    // and getAllVouches will surface it for reputation computations.
    db.saveVouch(credential);

    return credential;
  } finally {
    db.close();
  }
}

export const vouchCommand = new Command("vouch")
  .description("Vouch for another identity")
  .requiredOption("--target <id>", "Target identity ID (hex)")
  .option("--evidence <evidence>", "Evidence URI or inline proof")
  .option("--db <path>", "SQLite database file path", "./.auth/auth.db")
  .action((opts: VouchOptions) => {
    try {
      const credential = vouchForTarget(opts);
      console.log(JSON.stringify(credential, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
