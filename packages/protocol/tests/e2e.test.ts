/**
 * End-to-end integration test: protocol layer
 *
 * Full flow: create identities → build reputation → issue credentials → verify
 */

import { describe, it, expect } from "vitest";
import {
  createIdentity,
  attestCreation,
  vouchFor,
  createReputationStore,
  recordVouch,
  verifyCredential,
  contentHash,
  slashReputation,
  getReputation,
  SqliteStore,
  type Identity,
} from "../src/index.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

describe("protocol e2e", () => {
  it("full lifecycle: identity → reputation → attest → verify → slash", () => {
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");
    const carol = createIdentity("carol", "peer");
    const dave = createIdentity("dave", "peer");
    const eve = createIdentity("eve", "peer");

    const repStore = createReputationStore();

    // Phase 1: Alice and Bob vouch for Carol
    recordVouch(repStore, vouchFor(alice, carol.id, "known 3 years"));
    recordVouch(repStore, vouchFor(bob, carol.id, "collaborated on project"));

    const carolRep = getReputation(repStore, carol.id);
    expect(carolRep).toBeDefined();
    expect(carolRep!.overall).toBeGreaterThan(0);
    expect(carolRep!.dimensions[0].sampleSize).toBe(2);

    // Phase 2: Carol attests content
    const content = "My original human-written article about AI";
    const hash = contentHash(content);
    const carolCred = attestCreation(carol, hash, "none", "human-authored");

    // Phase 3: Verify Carol's credential — should pass with reputation
    const carolResult = verifyCredential(carolCred, repStore, { minReputation: 10 });
    expect(carolResult.status).toBe("valid");
    expect(carolResult.reputation!.overall).toBeGreaterThan(10);

    // Phase 4: Eve attests content but has no reputation
    const eveCred = attestCreation(eve, contentHash("eve's content"), "none");

    const eveResult = verifyCredential(eveCred, repStore, { minReputation: 10 });
    expect(eveResult.status).toBe("unknown-issuer");

    // Phase 5: Dave vouches for Eve too, boosting her reputation
    recordVouch(repStore, vouchFor(dave, eve.id));
    const eveResult2 = verifyCredential(eveCred, repStore, { minReputation: 10 });
    expect(eveResult2.status).toBe("valid");

    // Phase 6: Slash Carol's reputation
    slashReputation(repStore, carol.id, "false claim detected");

    const carolResult2 = verifyCredential(carolCred, repStore, { minReputation: 10 });
    expect(carolResult2.status).toBe("low-reputation");
    expect(carolResult2.reputation!.overall).toBe(0);
  });

  it("reputation grows with more vouches", () => {
    const repStore = createReputationStore();
    const target = createIdentity("target", "peer");

    // No vouches — no reputation
    expect(getReputation(repStore, target.id)).toBeUndefined();

    // 1 vouch
    const v1 = createIdentity("v1", "peer");
    recordVouch(repStore, vouchFor(v1, target.id));
    const rep1 = getReputation(repStore, target.id)!.overall;

    // 5 more vouches
    for (let i = 2; i <= 6; i++) {
      const v = createIdentity(`v${i}`, "peer");
      recordVouch(repStore, vouchFor(v, target.id));
    }
    const rep6 = getReputation(repStore, target.id)!.overall;

    // 10 more vouches
    for (let i = 7; i <= 16; i++) {
      const v = createIdentity(`v${i}`, "peer");
      recordVouch(repStore, vouchFor(v, target.id));
    }
    const rep16 = getReputation(repStore, target.id)!.overall;

    expect(rep6).toBeGreaterThan(rep1);
    expect(rep16).toBeGreaterThan(rep6);
    expect(rep16).toBeGreaterThan(80); // near max
  });

  it("SQLite persistence round-trip: save everything, reopen, verify", () => {
    const dbPath = join(tmpdir(), `auth-e2e-${Date.now()}-${Math.random()}.db`);

    // Create identities and credentials, save to SQLite
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");

    const store = new SqliteStore(dbPath);
    store.saveIdentity(alice);
    store.saveIdentity(bob);

    const cred = attestCreation(alice, contentHash("test content"), "none");
    store.saveCredential(cred);

    const vouch = vouchFor(bob, alice.id, "trust");
    store.saveVouch(vouch);

    store.close();

    // Reopen and verify
    const store2 = new SqliteStore(dbPath);
    const loadedAlice = store2.loadIdentity(alice.id);
    const loadedBob = store2.loadIdentityByHandle("bob");
    const loadedCreds = store2.loadCredentialsByIssuer(alice.id);
    const loadedVouches = store2.getVouchesFor(alice.id);

    expect(loadedAlice).toBeDefined();
    expect(loadedAlice!.handle).toBe("alice");
    expect(loadedBob).toBeDefined();
    expect(loadedCreds).toHaveLength(1);
    expect(loadedCreds[0].payload.subject.contentHash).toBe(contentHash("test content"));
    expect(loadedVouches).toHaveLength(1);
    expect(loadedVouches[0].payload.subject.targetId).toBe(alice.id);

    store2.close();
    rmSync(dbPath, { force: true });
  });
});