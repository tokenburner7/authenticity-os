/**
 * @auth/cli — `auth import` command
 *
 * Reads a W3C Verifiable Credential JSON from a file, converts it back to
 * the internal SignedCredential form, and appends it to the store's
 * `credentials` array.
 */

import { Command } from "commander";
import { fromW3CVC, type SignedCredential, type W3CVerifiableCredential } from "@auth/protocol";
import { loadStore, saveStore, type StoreData } from "../store.js";
import { readFileSync } from "node:fs";

export interface ImportOptions {
  file: string;
  store: string;
}

/**
 * Core import logic — testable without commander.
 * Throws on error (no process.exit).
 */
export function importCredential(opts: ImportOptions): SignedCredential {
  const raw = readFileSync(opts.file, "utf-8");
  let vc: W3CVerifiableCredential;
  try {
    vc = JSON.parse(raw) as W3CVerifiableCredential;
  } catch {
    throw new Error(`File ${opts.file} does not contain valid JSON.`);
  }

  if (
    !vc["@context"] ||
    !Array.isArray(vc.type) ||
    !vc.proof ||
    typeof vc.proof.proofValue !== "string"
  ) {
    throw new Error(
      `File ${opts.file} does not look like a W3C Verifiable Credential.`,
    );
  }

  const credential = fromW3CVC(vc);

  const data: StoreData = loadStore(opts.store);
  data.credentials = [...(data.credentials ?? []), credential];
  saveStore(opts.store, data);

  return credential;
}

export const importCommand = new Command("import")
  .description("Import a W3C Verifiable Credential from a file into the store")
  .requiredOption("--file <path>", "Path to the W3C VC JSON file")
  .option("--store <path>", "Path to the store JSON file", "./.auth/store.json")
  .action((opts: ImportOptions) => {
    try {
      const credential = importCredential(opts);
      console.log("✓ Credential imported and saved to", opts.store);
      console.log("  Type:    ", credential.payload.type);
      console.log("  Issuer:  ", credential.payload.issuer);
      console.log("  Issued:  ", credential.payload.issuedAt);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });
