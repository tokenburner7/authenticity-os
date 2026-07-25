/**
 * @auth/cli — SQLite database wrapper
 *
 * A CLI-friendly wrapper around the protocol's SqliteStore.
 * The CLI is single-user, so this exposes convenience methods that
 * operate on "the" local identity (the first one in the DB).
 *
 * Replaces the deprecated JSON file store (see store.ts).
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  SqliteStore,
  type Identity,
  type SignedCredential,
  type ReputationRecord,
} from "@auth/protocol";

export class CliDb {
  private store: SqliteStore;

  constructor(dbPath: string) {
    // Ensure the parent directory exists (e.g. ./.auth/)
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.store = new SqliteStore(dbPath);
  }

  // ── Identity ──────────────────────────────────────────────

  saveIdentity(identity: Identity): void {
    this.store.saveIdentity(identity);
  }

  /**
   * Load the single local identity (first by creation order).
   * Returns undefined if no identity exists yet.
   */
  loadIdentity(): Identity | undefined {
    const all = this.store.loadAllIdentities();
    return all.length > 0 ? all[0] : undefined;
  }

  // ── Credentials ──────────────────────────────────────────

  saveCredential(credential: SignedCredential): void {
    this.store.saveCredential(credential);
  }

  loadAllCredentials(): SignedCredential[] {
    return this.store.loadAllCredentials();
  }

  loadCredentialsByIssuer(issuerId: string): SignedCredential[] {
    return this.store.loadCredentialsByIssuer(issuerId);
  }

  loadCredentialByContentHash(hash: string): SignedCredential | undefined {
    return this.store.loadCredentialByContentHash(hash);
  }

  // ── Reputation ────────────────────────────────────────────

  saveReputation(record: ReputationRecord): void {
    this.store.saveReputation(record);
  }

  loadReputation(identityId: string): ReputationRecord | undefined {
    return this.store.loadReputation(identityId);
  }

  // ── Vouches ───────────────────────────────────────────────

  saveVouch(vouch: SignedCredential): void {
    this.store.saveVouch(vouch);
  }

  getVouchesFor(identityId: string): SignedCredential[] {
    return this.store.getVouchesFor(identityId);
  }

  /**
   * Return all vouch-type credentials in the DB.
   * Used to build an in-memory reputation store for verification.
   */
  getAllVouches(): SignedCredential[] {
    return this.loadAllCredentials().filter(
      (c) => c.payload.type === "vouch",
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────

  close(): void {
    this.store.close();
  }
}
