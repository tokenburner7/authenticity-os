import { describe, it, expect } from "vitest";
import {
  createIdentity,
  issueCredential,
  attestCreation,
  vouchFor,
  delegateCreation,
  verifyCredentialSignature,
  contentHash,
  toW3CVC,
  fromW3CVC,
  type SignedCredential,
  type W3CVerifiableCredential,
} from "../src/index.js";

describe("W3C VC conversion", () => {
  it("toW3CVC produces correct @context, type array, and proof format", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("some content");
    const credential = attestCreation(alice, hash, "none", "screenshot");

    const vc = toW3CVC(credential);

    // @context: W3C VC base + our extension
    expect(vc["@context"]).toEqual([
      "https://www.w3.org/2018/credentials/v1",
      "https://authenticity-os.org/2026/credentials/v1",
    ]);

    // type: VerifiableCredential + protocol type
    expect(vc.type).toEqual(["VerifiableCredential", "creation"]);

    // issuer = identity id
    expect(vc.issuer).toBe(alice.id);

    // issuanceDate mirrors payload.issuedAt
    expect(vc.issuanceDate).toBe(credential.payload.issuedAt);

    // credentialSubject carries protocol fields
    expect(vc.credentialSubject.type).toBe("creation");
    expect(vc.credentialSubject.aiAssistance).toBe("none");
    expect(vc.credentialSubject.contentHash).toBe(hash);
    expect(vc.credentialSubject.evidence).toBe("screenshot");

    // proof is Ed25519Signature2018 with proofValue + verificationMethod
    expect(vc.proof.type).toBe("Ed25519Signature2018");
    expect(vc.proof.proofValue).toBe(credential.signature);
    expect(vc.proof.verificationMethod).toBe(alice.id);
    expect(vc.proof.created).toBe(credential.payload.issuedAt);
    // nonce carried for round-trip verification
    expect(vc.proof.nonce).toBe(credential.payload.nonce);
  });

  it("fromW3CVC round-trips back to identical internal format", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("round-trip content");
    const original = attestCreation(alice, hash, "partial", "some evidence");

    const vc = toW3CVC(original);
    const restored = fromW3CVC(vc);

    expect(restored).toEqual(original);
  });

  it("preserves vouch credential structure across round-trip", () => {
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");
    const original = vouchFor(alice, bob.id, "known personally");

    const restored = fromW3CVC(toW3CVC(original));

    expect(restored.payload.type).toBe("vouch");
    expect(restored.payload.subject.targetId).toBe(bob.id);
    expect(restored.payload.subject.evidence).toBe("known personally");
    expect(restored).toEqual(original);
  });

  it("preserves delegation credential structure across round-trip", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("AI drafted this");
    const original = delegateCreation(alice, hash, "ai-assisted", "agent-v1");

    const restored = fromW3CVC(toW3CVC(original));

    expect(restored.payload.type).toBe("delegation");
    expect(restored).toEqual(original);
  });

  it("signature still verifies after full export/import round-trip", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("verifiable content");
    const credential = attestCreation(alice, hash, "none");

    // Export → serialise → parse back → import
    const json = JSON.stringify(toW3CVC(credential));
    const vc = JSON.parse(json) as W3CVerifiableCredential;
    const restored = fromW3CVC(vc);

    expect(verifyCredentialSignature(restored)).toBe(true);
  });

  it("signature verifies for a vouch after round-trip through issueCredential", () => {
    const alice = createIdentity("alice", "peer");
    const bob = createIdentity("bob", "peer");
    const credential = issueCredential(
      "vouch",
      alice,
      { targetId: bob.id, aiAssistance: "none", evidence: "trusted" },
    );

    const restored = fromW3CVC(toW3CVC(credential));

    expect(verifyCredentialSignature(restored)).toBe(true);
    expect(restored.payload.subject.targetId).toBe(bob.id);
  });

  it("preserves expiresAt across round-trip when set", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("expiring content");
    // issueCredential with expiresIn option populates payload.expiresAt
    const credential = issueCredential("creation", alice, {
      contentHash: hash,
      aiAssistance: "none",
    }, { expiresIn: 3600 });

    // sanity: the original actually has expiresAt
    expect(credential.payload.expiresAt).toBeDefined();

    const vc = toW3CVC(credential);
    expect(vc.expirationDate).toBe(credential.payload.expiresAt);

    const restored = fromW3CVC(vc);
    expect(restored.payload.expiresAt).toBe(credential.payload.expiresAt);
    expect(restored).toEqual(credential);
    expect(verifyCredentialSignature(restored)).toBe(true);
  });

  it("omits expirationDate on the VC when payload has no expiresAt", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("no expiry");
    const credential = attestCreation(alice, hash, "none");

    const vc = toW3CVC(credential);
    expect(vc.expirationDate).toBeUndefined();
  });

  it("preserves custom claims across round-trip", () => {
    const alice = createIdentity("alice", "peer");
    const hash = contentHash("with claims");
    const credential = issueCredential("creation", alice, {
      contentHash: hash,
      aiAssistance: "fully-ai",
      evidence: "agent-draft",
      claims: { framework: "claude", version: "3" },
    }) as SignedCredential;

    const restored = fromW3CVC(toW3CVC(credential));

    expect(restored.payload.subject.claims).toEqual({
      framework: "claude",
      version: "3",
    });
    expect(restored).toEqual(credential);
    expect(verifyCredentialSignature(restored)).toBe(true);
  });
});
