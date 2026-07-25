/**
 * @auth/protocol — Persistence store interface
 *
 * Defines the storage contract for protocol data.
 * v0.1: SQLite implementation. Future: PostgreSQL, IndexedDB.
 */

import type { Identity } from "./identity.js";
import type { SignedCredential } from "./types.js";
import type { ReputationRecord } from "./types.js";

export interface ProtocolStore {
  // Identity
  saveIdentity(identity: Identity): void;
  loadIdentity(id: string): Identity | undefined;
  loadIdentityByHandle(handle: string): Identity | undefined;

  // Credentials
  saveCredential(credential: SignedCredential): void;
  loadCredentialsByIssuer(issuerId: string): SignedCredential[];
  loadCredentialByContentHash(hash: string): SignedCredential | undefined;
  loadAllCredentials(): SignedCredential[];

  // Reputation
  saveReputation(record: ReputationRecord): void;
  loadReputation(identityId: string): ReputationRecord | undefined;

  // Vouches (special credential query)
  saveVouch(vouch: SignedCredential): void;
  getVouchesFor(identityId: string): SignedCredential[];

  close(): void;
}