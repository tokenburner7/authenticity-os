import { describe, it, expect } from "vitest";
import {
  createIdentity,
  attestCreation,
  vouchFor,
  issueCredential,
  createReputationStore,
  recordVouch,
  verifyCredential,
  contentHash,
  sign,
  canonicalise,
} from "../src/index.js";

describe("verification", () => {
  it("verifies a valid credential with good reputation", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");
    const carol = createIdentity("carol", "peer");

    // Build Alice's reputation
    recordVouch(store, vouchFor(bob, alice.id));
    recordVouch(store, vouchFor(carol, alice.id));

    const hash = contentHash("my content");
    const credential = attestCreation(alice, hash, "none");

    const result = verifyCredential(credential, store, { minReputation: 10 });
    expect(result.status).toBe("valid");
    expect(result.credential).toBeDefined();
    expect(result.reputation).toBeDefined();
  });

  it("rejects credential with low reputation", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");

    const hash = contentHash("my content");
    const credential = attestCreation(alice, hash, "none");

    const result = verifyCredential(credential, store, { minReputation: 50 });
    expect(result.status).toBe("unknown-issuer");
  });

  it("rejects credential with invalid signature", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");

    const hash = contentHash("my content");
    const credential = attestCreation(alice, hash, "none");

    // Tamper
    credential.payload.subject.aiAssistance = "fully-ai";

    const result = verifyCredential(credential, store);
    expect(result.status).toBe("invalid-signature");
  });

  it("rejects expired credentials", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");

    const hash = contentHash("my content");
    // Issue with expiry in the past, then re-sign properly
    const credential = attestCreation(alice, hash, "none");
    credential.payload.expiresAt = new Date(Date.now() - 1000).toISOString();
    credential.signature = sign(canonicalise(credential.payload), alice.secretKey);

    const result = verifyCredential(credential, store);
    expect(result.status).toBe("expired");
  });

  it("verifies without reputation threshold (any valid credential)", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");

    const hash = contentHash("my content");
    const credential = attestCreation(alice, hash, "none");

    const result = verifyCredential(credential, store);
    expect(result.status).toBe("valid");
  });
});
