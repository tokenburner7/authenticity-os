import { describe, it, expect } from "vitest";
import {
  createIdentity,
  vouchFor,
  createReputationStore,
  recordVouch,
  getReputation,
  slashReputation,
  meetsThreshold,
} from "../src/index.js";

describe("reputation", () => {
  it("starts with no reputation for unknown identities", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");
    expect(getReputation(store, alice.id)).toBeUndefined();
    expect(meetsThreshold(store, alice.id, 10)).toBe(false);
  });

  it("builds reputation from vouches", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");
    const carol = createIdentity("carol", "peer");

    // Alice and Bob vouch for Carol
    recordVouch(store, vouchFor(alice, carol.id));
    recordVouch(store, vouchFor(bob, carol.id));

    const rep = getReputation(store, carol.id);
    expect(rep).toBeDefined();
    expect(rep!.overall).toBeGreaterThan(0);
    expect(rep!.dimensions[0].dimension).toBe("social-trust");
    expect(rep!.dimensions[0].sampleSize).toBe(2);
  });

  it("increases reputation with more vouches (diminishing returns)", () => {
    const store = createReputationStore();
    const target = createIdentity("target", "peer");

    // 1 vouch
    const v1 = createIdentity("v1", "peer");
    recordVouch(store, vouchFor(v1, target.id));
    const rep1 = getReputation(store, target.id)!.overall;

    // 5 more vouches
    for (let i = 2; i <= 6; i++) {
      const v = createIdentity(`v${i}`, "peer");
      recordVouch(store, vouchFor(v, target.id));
    }
    const rep6 = getReputation(store, target.id)!.overall;

    expect(rep6).toBeGreaterThan(rep1);
    expect(rep6).toBeLessThanOrEqual(100);
  });

  it("slashes reputation to zero", () => {
    const store = createReputationStore();
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");

    recordVouch(store, vouchFor(alice, bob.id));
    expect(getReputation(store, bob.id)!.overall).toBeGreaterThan(0);

    slashReputation(store, bob.id, "false claim detected");
    expect(getReputation(store, bob.id)!.overall).toBe(0);
    expect(meetsThreshold(store, bob.id, 1)).toBe(false);
  });

  it("meets threshold correctly", () => {
    const store = createReputationStore();
    const target = createIdentity("target", "peer");

    // No reputation — fails any threshold
    expect(meetsThreshold(store, target.id, 1)).toBe(false);

    // Many vouches — should pass a moderate threshold
    for (let i = 1; i <= 10; i++) {
      const v = createIdentity(`v${i}`, "peer");
      recordVouch(store, vouchFor(v, target.id));
    }

    const rep = getReputation(store, target.id)!.overall;
    expect(rep).toBeGreaterThan(50);
    expect(meetsThreshold(store, target.id, 50)).toBe(true);
  });
});
