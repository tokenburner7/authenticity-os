import { Command } from "commander";
import {
  createIdentity,
  toAnchor,
  type AssuranceLevel,
} from "@auth/protocol";
import { CliDb } from "../db.js";

const VALID_ASSURANCE: AssuranceLevel[] = [
  "peer",
  "social",
  "biometric",
  "government",
];

function parseAssurance(value: string): AssuranceLevel {
  if (!VALID_ASSURANCE.includes(value as AssuranceLevel)) {
    throw new Error(
      `Invalid assurance level "${value}". Must be one of: ${VALID_ASSURANCE.join(", ")}`,
    );
  }
  return value as AssuranceLevel;
}

/**
 * `auth identity` — manage the local identity anchor.
 */
export const identityCommand = new Command("identity").description(
  "Manage the local identity anchor",
);

identityCommand
  .command("create")
  .description("Create a new identity anchor and save it to the database")
  .requiredOption("--handle <handle>", "Human-readable handle for the identity")
  .option("--db <path>", "Path to the SQLite database file", "./.auth/auth.db")
  .option(
    "--assurance <level>",
    "Assurance level (peer | social | biometric | government)",
    "peer",
  )
  .action((opts: { handle: string; db: string; assurance: string }) => {
    try {
      const assurance = parseAssurance(opts.assurance);
      const identity = createIdentity(opts.handle, assurance);

      const db = new CliDb(opts.db);
      db.saveIdentity(identity);
      db.close();

      console.log("✓ Identity created and saved to", opts.db);
      console.log("  Handle:    ", identity.handle);
      console.log("  ID:        ", identity.id);
      console.log("  Assurance: ", identity.assurance);
      console.log("  Created:   ", identity.createdAt);
      console.log("");
      console.log("⚠  Keep your secret key safe. It is stored locally in plaintext.");
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
  });

identityCommand
  .command("show")
  .description("Display the identity anchor from the database")
  .option("--db <path>", "Path to the SQLite database file", "./.auth/auth.db")
  .action((opts: { db: string }) => {
    const db = new CliDb(opts.db);
    const identity = db.loadIdentity();
    db.close();

    if (!identity) {
      console.error("No identity found in database:", opts.db);
      console.error("Create one with: auth identity create --handle <handle>");
      process.exitCode = 1;
      return;
    }

    const anchor = toAnchor(identity);

    console.log("Identity Anchor");
    console.log("  Handle:    ", anchor.handle);
    console.log("  ID:        ", anchor.id);
    console.log("  Assurance: ", anchor.assurance);
    console.log("  Created:   ", anchor.createdAt);
  });
