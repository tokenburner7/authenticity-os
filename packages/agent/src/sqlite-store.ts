/**
 * @auth/agent — SQLite persistence
 *
 * Implements AgentStore using better-sqlite3.
 * Stores agent profiles, wallet credentials, social graph, and interaction logs.
 */

import { createRequire } from "node:module";
import type { AgentStore } from "./store.js";
import type { AgentProfile, AgentCapability } from "./types.js";
import type { SignedCredential } from "@auth/protocol";

// better-sqlite3 is CommonJS; use createRequire for clean ESM import
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3") as typeof import("better-sqlite3");

export class SqliteAgentStore implements AgentStore {
  private db: InstanceType<typeof Database>;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        bio TEXT,
        capabilities TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wallet_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        credential_json TEXT NOT NULL,
        saved_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_wallet_creds_agent ON wallet_credentials(agent_id);

      CREATE TABLE IF NOT EXISTS known_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        known_id TEXT NOT NULL,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        bio TEXT,
        capabilities TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        UNIQUE(agent_id, known_id)
      );

      CREATE INDEX IF NOT EXISTS idx_known_agents_agent ON known_agents(agent_id);

      CREATE TABLE IF NOT EXISTS interaction_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        other_agent_id TEXT NOT NULL,
        interacted_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_interactions_agent ON interaction_log(agent_id);
    `);
  }

  // ── Profile ───────────────────────────────────────────────

  saveProfile(profile: AgentProfile): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO agent_profiles (id, name, owner_id, bio, capabilities, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      profile.id,
      profile.name,
      profile.ownerId,
      profile.bio,
      JSON.stringify(profile.capabilities),
      profile.createdAt
    );
  }

  loadProfile(agentId: string): AgentProfile | undefined {
    const row = this.db.prepare("SELECT * FROM agent_profiles WHERE id = ?").get(agentId) as ProfileRow | undefined;
    return row ? rowToProfile(row) : undefined;
  }

  // ── Wallet credentials ───────────────────────────────────

  saveCredential(agentId: string, credential: SignedCredential): void {
    this.db.prepare(`
      INSERT INTO wallet_credentials (agent_id, credential_json, saved_at)
      VALUES (?, ?, ?)
    `).run(agentId, JSON.stringify(credential), new Date().toISOString());
  }

  loadCredentials(agentId: string): SignedCredential[] {
    const rows = this.db.prepare("SELECT * FROM wallet_credentials WHERE agent_id = ? ORDER BY saved_at").all(agentId) as CredentialRow[];
    return rows.map(r => JSON.parse(r.credential_json) as SignedCredential);
  }

  // ── Social graph ─────────────────────────────────────────

  saveKnownAgent(agentId: string, profile: AgentProfile): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO known_agents (agent_id, known_id, name, owner_id, bio, capabilities, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      agentId,
      profile.id,
      profile.name,
      profile.ownerId,
      profile.bio,
      JSON.stringify(profile.capabilities),
      profile.createdAt
    );
  }

  loadKnownAgents(agentId: string): AgentProfile[] {
    const rows = this.db.prepare("SELECT * FROM known_agents WHERE agent_id = ?").all(agentId) as KnownAgentRow[];
    return rows.map(rowToKnownAgent);
  }

  // ── Interaction log ──────────────────────────────────────

  recordInteraction(agentId: string, otherAgentId: string): void {
    this.db.prepare(`
      INSERT INTO interaction_log (agent_id, other_agent_id, interacted_at)
      VALUES (?, ?, ?)
    `).run(agentId, otherAgentId, new Date().toISOString());
  }

  getInteractionCounts(agentId: string): Map<string, number> {
    const rows = this.db.prepare(`
      SELECT other_agent_id, COUNT(*) as count
      FROM interaction_log
      WHERE agent_id = ?
      GROUP BY other_agent_id
    `).all(agentId) as InteractionCountRow[];

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.other_agent_id, row.count);
    }
    return counts;
  }

  close(): void {
    this.db.close();
  }
}

// ── Row types and converters ────────────────────────────────

interface ProfileRow {
  id: string;
  name: string;
  owner_id: string;
  bio: string;
  capabilities: string;
  created_at: string;
}

function rowToProfile(row: ProfileRow): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    bio: row.bio,
    capabilities: JSON.parse(row.capabilities) as AgentCapability[],
    createdAt: row.created_at,
  };
}

interface CredentialRow {
  credential_json: string;
}

interface KnownAgentRow {
  known_id: string;
  name: string;
  owner_id: string;
  bio: string;
  capabilities: string;
  created_at: string;
}

function rowToKnownAgent(row: KnownAgentRow): AgentProfile {
  return {
    id: row.known_id,
    name: row.name,
    ownerId: row.owner_id,
    bio: row.bio,
    capabilities: JSON.parse(row.capabilities) as AgentCapability[],
    createdAt: row.created_at,
  };
}

interface InteractionCountRow {
  other_agent_id: string;
  count: number;
}
