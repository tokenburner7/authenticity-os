/**
 * @auth/cli — `auth export` command
 *
 * Loads a credential from the local database and exports it as a W3C
 * Verifiable Credential (JSON). Defaults to w3c format.
 */

import { Command } from "commander";
import { toW3CVC, type W3CVerifiableCredential } from "@auth/protocol";
import { CliDb } from "../db.js";

export interface ExportOptions {
  index: string;
  db: string;
  format: string;
}

/**
 * Core export logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function exportCredential(opts: ExportOptions): W3CVerifiableCredential {
  const db = new CliDb(opts.db);
  try {
    const credentials = db.loadAllCredentials();

    if (credentials.length === 0) {
      throw new Error(
        "No credentials found in database. Run `auth attest` or `auth vouch` first.",
      );
    }

    const index = Number(opts.index);
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`Invalid index "${opts.index}". Must be a non-negative integer.`);
    }
    if (index >= credentials.length) {
      throw new Error(
        `Index ${index} out of range. Database has ${credentials.length} credential(s) (0..${credentials.length - 1}).`,
      );
    }

    if (opts.format !== "w3c") {
      throw new Error(
        `Unsupported format "${opts.format}". Currently only "w3c" is supported.`,
      );
    }

    const credential = credentials[index] as Parameters<typeof toW3CVC>[0];
    return toW3CVC(credential);
  } finally {
    db.close();
  }
}

export const exportCommand = new Command("export")
  .description("Export a credential from the database as a W3C Verifiable Credential")
  .option("--index <n>", "Index of the credential in the database", "0")
  .option("--db <path>", "Path to the SQLite database file", "./.auth/auth.db")
  .option("--format <format>", "Export format (w3c)", "w3c")
  .action((opts: ExportOptions) => {
    try {
      const vc = exportCredential(opts);
      console.log(JSON.stringify(vc, null, 2));
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
