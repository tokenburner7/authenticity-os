import { describe, it, expect } from "vitest";
import {
  createIdentity,
  toAnchor,
  upgradeAssurance,
} from "../src/index.js";

describe("identity", () => {
  it("creates an identity with a keypair", () => {
    const id = createIdentity("alice", "peer");
    expect(id.handle).toBe("alice");
    expect(id.assurance).toBe("peer");
    expect(id.id).toMatch(/^[0-9a-f]{64}$/);
    expect(id.secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(id.createdAt).toBeDefined();
  });

  it("converts to an anchor without leaking the secret key", () => {
    const id = createIdentity("bob", "social");
    const anchor = toAnchor(id);
    expect(anchor.id).toBe(id.id);
    expect(anchor.handle).toBe("bob");
    expect(anchor.assurance).toBe("social");
    expect("secretKey" in anchor).toBe(false);
  });

  it("upgrades assurance level upward only", () => {
    const id = createIdentity("carol", "peer");
    const upgraded = upgradeAssurance(id, "biometric");
    expect(upgraded.assurance).toBe("biometric");
    expect(upgraded.id).toBe(id.id); // same keypair

    // Downgrade should be a no-op
    const downgraded = upgradeAssurance(upgraded, "peer");
    expect(downgraded.assurance).toBe("biometric");
  });
});
