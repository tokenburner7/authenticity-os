import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SqliteStore,
  createIdentity,
  attestCreation,
  vouchFor,
  recordVouch,
  createReputationStore,
  getReputation,
  type Identity,
} from "../src/index.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

describe("SQLite store", () => {
  let store: SqliteStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `auth-test-${Date.now()}-${Math.random()}.db`);
    store = new SqliteStore(dbPath);
  });

  afterEach(() => {
    store.close();
    rmSync(dbPath, { force: true });
  });

  describe("identity", () => {
    it("saves and loads an identity by ID", () => {
      const alice = createIdentity("alice", "peer");
      store.saveIdentity(alice);

      const loaded = store.loadIdentity(alice.id);
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe(alice.id);
      expect(loaded!.handle).toBe("alice");
      expect(loaded!.secretKey).toBe(alice.secretKey);
      expect(loaded!.assurance).toBe("peer");
    });

    it("loads an identity by handle", () => {
      const bob = createIdentity("bob", "social");
      store.saveIdentity(bob);

      const loaded = store.loadIdentityByHandle("bob");
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe(bob.id);
    });

    it("returns undefined for unknown identity", () => {
      expect(store.loadIdentity("nonexistent")).toBeUndefined();
      expect(store.loadIdentityByHandle("nobody")).toBeUndefined();
    });
  });

  describe("credentials", () => {
    it("saves and loads credentials by issuer", () => {
      const alice = createIdentity("alice", "peer");
      store.saveIdentity(alice);

      const cred1 = attestCreation(alice, "hash1", "none");
      const cred2 = attestCreation(alice, "hash2", "partial");
      store.saveCredential(cred1);
      store.saveCredential(cred2);

      const loaded = store.loadCredentialsByIssuer(alice.id);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].payload.subject.contentHash).toBe("hash1");
      expect(loaded[1].payload.subject.contentHash).toBe("hash2");
    });

    it("loads a credential by content hash", () => {
      const alice = createIdentity("alice", "peer");
      store.saveIdentity(alice);

      const cred = attestCreation(alice, "special-hash", "none");
      store.saveCredential(cred);

      const loaded = store.loadCredentialByContentHash("special-hash");
      expect(loaded).toBeDefined();
      expect(loaded!.payload.subject.contentHash).toBe("special-hash");
    });

    it("returns undefined for unknown content hash", () => {
      expect(store.loadCredentialByContentHash("nonexistent")).toBeUndefined();
    });

    it("loads all credentials", () => {
      const alice = createIdentity("alice", "peer");
      const bob = createIdentity("bob", "peer");
      store.saveIdentity(alice);
      store.saveIdentity(bob);

      store.saveCredential(attestCreation(alice, "hash-a", "none"));
      store.saveCredential(attestCreation(bob, "hash-b", "none"));

      const all = store.loadAllCredentials();
      expect(all).toHaveLength(2);
    });
  });

  describe("reputation", () => {
    it("saves and loads reputation records", () => {
      const alice = createIdentity("alice", "peer");
      const bob = createIdentity("bob", "peer");

      const repStore = createReputationStore();
      recordVouch(repStore, vouchFor(alice, bob.id));
      recordVouch(repStore, vouchFor(alice, bob.id));

      const rep = getReputation(repStore, bob.id)!;
      store.saveReputation(rep);

      const loaded = store.loadReputation(bob.id);
      expect(loaded).toBeDefined();
      expect(loaded!.identityId).toBe(bob.id);
      expect(loaded!.overall).toBe(rep.overall);
      expect(loaded!.dimensions).toHaveLength(1);
      expect(loaded!.dimensions[0].dimension).toBe("social-trust");
    });

    it("returns undefined for unknown reputation", () => {
      expect(store.loadReputation("unknown")).toBeUndefined();
    });
  });

  describe("vouches", () => {
    it("saves and queries vouches for a target identity", () => {
      const alice = createIdentity("alice", "peer");
      const bob = createIdentity("bob", "peer");
      const carol = createIdentity("carol", "peer");

      store.saveIdentity(alice);
      store.saveIdentity(bob);
      store.saveIdentity(carol);

      // Alice and Bob vouch for Carol
      const v1 = vouchFor(alice, carol.id, "known 5 years");
      const v2 = vouchFor(bob, carol.id, "collaborated on project");
      store.saveVouch(v1);
      store.saveVouch(v2);

      const vouches = store.getVouchesFor(carol.id);
      expect(vouches).toHaveLength(2);
      expect(vouches[0].payload.type).toBe("vouch");
      expect(vouches[0].payload.subject.targetId).toBe(carol.id);
    });

    it("returns empty for identity with no vouches", () => {
      const carol = createIdentity("carol", "peer");
      expect(store.getVouchesFor(carol.id)).toHaveLength(0);
    });
  });

  describe("persistence across instances", () => {
    it("data survives close and reopen", () => {
      const alice = createIdentity("alice", "peer");
      store.saveIdentity(alice);
      store.saveCredential(attestCreation(alice, "test-hash", "none"));
      store.close();

      // Reopen same database
      const store2 = new SqliteStore(dbPath);
      const loaded = store2.loadIdentity(alice.id);
      expect(loaded).toBeDefined();
      expect(loaded!.handle).toBe("alice");

      const creds = store2.loadCredentialsByIssuer(alice.id);
      expect(creds).toHaveLength(1);
      expect(creds[0].payload.subject.contentHash).toBe("test-hash");

      store2.close();
    });
  });
});