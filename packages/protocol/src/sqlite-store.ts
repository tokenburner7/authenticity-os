/**
 * @auth/protocol — SQLite persistence
 *
 * Implements ProtocolStore using better-sqlite3.
 * All data is stored locally — no network calls, no external dependencies.
 */

import { createRequire } from "node:module";
import type { ProtocolStore } from "./store.js";
import type { Identity } from "./identity.js";
import type { SignedCredential, ReputationRecord, ReputationDimension } from "./types.js";

// better-sqlite3 is CommonJS; use createRequire for clean ESM import
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

export class SqliteStore implements ProtocolStore {
  private db: InstanceType<typeof Database>;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identities (
        id TEXT PRIMARY KEY,
        handle TEXT NOT NULL,
        secret_key TEXT NOT NULL,
        assurance TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload_json TEXT NOT NULL,
        signature TEXT NOT NULL,
        signer TEXT NOT NULL,
        type TEXT NOT NULL,
        content_hash TEXT,
        target_id TEXT,
        issued_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_credentials_issuer ON credentials(signer);
      CREATE INDEX IF NOT EXISTS idx_credentials_content_hash ON credentials(content_hash);
      CREATE INDEX IF NOT EXISTS idx_credentials_target ON credentials(target_id);

      CREATE TABLE IF NOT EXISTS reputation (
        identity_id TEXT PRIMARY KEY,
        overall INTEGER NOT NULL,
        dimensions_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  // ── Identity ──────────────────────────────────────────────

  saveIdentity(identity: Identity): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO identities (id, handle, secret_key, assurance, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(identity.id, identity.handle, identity.secretKey, identity.assurance, identity.createdAt);
  }

  loadIdentity(id: string): Identity | undefined {
    const row = this.db.prepare("SELECT * FROM identities WHERE id = ?").get(id) as IdentityRow | undefined;
    return row ? rowToIdentity(row) : undefined;
  }

  loadIdentityByHandle(handle: string): Identity | undefined {
    const row = this.db.prepare("SELECT * FROM identities WHERE handle = ?").get(handle) as IdentityRow | undefined;
    return row ? rowToIdentity(row) : undefined;
  }

  // ── Credentials ──────────────────────────────────────────

  saveCredential(credential: SignedCredential): void {
    const payload = credential.payload;
    this.db.prepare(`
      INSERT INTO credentials (payload_json, signature, signer, type, content_hash, target_id, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      JSON.stringify(payload),
      credential.signature,
      credential.signer,
      payload.type,
      payload.subject.contentHash ?? null,
      payload.subject.targetId ?? null,
      payload.issuedAt
    );
  }

  loadCredentialsByIssuer(issuerId: string): SignedCredential[] {
    const rows = this.db.prepare("SELECT * FROM credentials WHERE signer = ?").all(issuerId) as CredentialRow[];
    return rows.map(rowToCredential);
  }

  loadCredentialByContentHash(hash: string): SignedCredential | undefined {
    const row = this.db.prepare("SELECT * FROM credentials WHERE content_hash = ? LIMIT 1").get(hash) as CredentialRow | undefined;
    return row ? rowToCredential(row) : undefined;
  }

  loadAllCredentials(): SignedCredential[] {
    const rows = this.db.prepare("SELECT * FROM credentials").all() as CredentialRow[];
    return rows.map(rowToCredential);
  }

  // ── Reputation ────────────────────────────────────────────

  saveReputation(record: ReputationRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO reputation (identity_id, overall, dimensions_json, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(record.identityId, record.overall, JSON.stringify(record.dimensions), record.updatedAt);
  }

  loadReputation(identityId: string): ReputationRecord | undefined {
    const row = this.db.prepare("SELECT * FROM reputation WHERE identity_id = ?").get(identityId) as ReputationRow | undefined;
    if (!row) return undefined;
    return {
      identityId: row.identity_id,
      overall: row.overall,
      dimensions: JSON.parse(row.dimensions_json) as ReputationDimension[],
      updatedAt: row.updated_at,
    };
  }

  // ── Vouches ───────────────────────────────────────────────

  saveVouch(vouch: SignedCredential): void {
    this.saveCredential(vouch);
  }

  getVouchesFor(identityId: string): SignedCredential[] {
    const rows = this.db.prepare("SELECT * FROM credentials WHERE type = 'vouch' AND target_id = ?").all(identityId) as CredentialRow[];
    return rows.map(rowToCredential);
  }

  close(): void {
    this.db.close();
  }
}

// ── Row types and converters ────────────────────────────────

interface IdentityRow {
  id: string;
  handle: string;
  secret_key: string;
  assurance: string;
  created_at: string;
}

function rowToIdentity(row: IdentityRow): Identity {
  return {
    id: row.id,
    handle: row.handle,
    secretKey: row.secret_key,
    assurance: row.assurance as Identity["assurance"],
    createdAt: row.created_at,
  };
}

interface CredentialRow {
  payload_json: string;
  signature: string;
  signer: string;
}

function rowToCredential(row: CredentialRow): SignedCredential {
  return {
    payload: JSON.parse(row.payload_json),
    signature: row.signature,
    signer: row.signer,
  };
}

interface ReputationRow {
  identity_id: string;
  overall: number;
  dimensions_json: string;
  updated_at: string;
}