/**
 * @deprecated This JSON file store is deprecated and no longer used by the CLI.
 * All commands now persist data via the SQLite wrapper in `./db.ts` (CliDb),
 * backed by the protocol's SqliteStore. The default storage path moved from
 * `./.auth/store.json` to `./.auth/auth.db`.
 *
 * This file is retained only for reference and potential migration tooling.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface StoreData {
  identity?: {
    id: string;
    handle: string;
    secretKey: string;
    assurance: string;
    createdAt: string;
  };
  credentials?: unknown[];
  reputation?: { vouches: unknown[] };
}

/** @deprecated Use CliDb (./db.ts) instead. */
export function loadStore(path: string): StoreData {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** @deprecated Use CliDb (./db.ts) instead. */
export function saveStore(path: string, data: StoreData): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}
