import { describe, it, expect } from "vitest";
import {
  generateKeyPair,
  sign,
  verify,
  canonicalise,
  contentHash,
  generateNonce,
} from "../src/index.js";

describe("crypto", () => {
  it("generates a valid Ed25519 keypair", () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.secretKey).toMatch(/^[0-9a-f]{64}$/);
    expect(kp.publicKey).not.toBe(kp.secretKey);
  });

  it("signs and verifies a message", () => {
    const kp = generateKeyPair();
    const message = Buffer.from("hello world", "utf-8");
    const signature = sign(message, kp.secretKey);
    expect(signature).toMatch(/^[0-9a-f]{128}$/);
    expect(verify(message, signature, kp.publicKey)).toBe(true);
  });

  it("rejects a tampered message", () => {
    const kp = generateKeyPair();
    const message = Buffer.from("hello world", "utf-8");
    const signature = sign(message, kp.secretKey);
    const tampered = Buffer.from("hello world!", "utf-8");
    expect(verify(tampered, signature, kp.publicKey)).toBe(false);
  });

  it("rejects a wrong public key", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const message = Buffer.from("hello", "utf-8");
    const signature = sign(message, kp1.secretKey);
    expect(verify(message, signature, kp2.publicKey)).toBe(false);
  });

  it("canonicalises objects deterministically regardless of key order", () => {
    const obj1 = { a: 1, b: 2, c: 3 };
    const obj2 = { c: 3, b: 2, a: 1 };
    expect(canonicalise(obj1)).toEqual(canonicalise(obj2));
  });

  it("produces consistent content hashes", () => {
    const hash1 = contentHash("test content");
    const hash2 = contentHash("test content");
    const hash3 = contentHash("different content");
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toMatch(/^[0-9a-f]{128}$/);
  });

  it("generates unique nonces", () => {
    const n1 = generateNonce();
    const n2 = generateNonce();
    expect(n1).not.toBe(n2);
    expect(n1).toMatch(/^[0-9a-f]{64}$/);
  });
});
