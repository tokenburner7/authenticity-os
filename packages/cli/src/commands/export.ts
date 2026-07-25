/**
 * @auth/cli — `auth export` command
 *
 * Loads a credential from the local store and exports it as a W3C
 * Verifiable Credential (JSON). Defaults to w3c format.
 */

import { Command } from "commander";
import { toW3CVC, type W3CVerifiableCredential } from "@auth/protocol";
import { loadStore, type StoreData } from "../store.js";

export interface ExportOptions {
  index: string;
  store: string;
  format: string;
}

/**
 * Core export logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function exportCredential(opts: ExportOptions): W3CVerifiableCredential {
  const data: StoreData = loadStore(opts.store);

  if (!data.credentials || data.credentials.length === 0) {
    throw new Error(
      "No credentials found in store. Run `auth attest` or `auth vouch` first.",
    );
  }

  const index = Number(opts.index);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid index "${opts.index}". Must be a non-negative integer.`);
  }
  if (index >= data.credentials.length) {
    throw new Error(
      `Index ${index} out of range. Store has ${data.credentials.length} credential(s) (0..${data.credentials.length - 1}).`,
    );
  }

  if (opts.format !== "w3c") {
    throw new Error(
      `Unsupported format "${opts.format}". Currently only "w3c" is supported.`,
    );
  }

  const credential = data.credentials[index] as Parameters<typeof toW3CVC>[0];
  return toW3CVC(credential);
}

export const exportCommand = new Command("export")
  .description("Export a credential from the store as a W3C Verifiable Credential")
  .option("--index <n>", "Index of the credential in the store", "0")
  .option("--store <path>", "Path to the store JSON file", "./.auth/store.json")
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
