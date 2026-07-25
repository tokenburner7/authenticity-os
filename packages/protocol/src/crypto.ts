/**
 * @auth/protocol — Cryptographic primitives
 *
 * Ed25519 key generation, signing, and verification.
 * Uses @noble/ed25519 — audited, pure JS, no native dependencies.
 */

import * as ed25519 from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2";
import { randomBytes } from "@noble/hashes/utils";

// Tell noble to use sha512 internally (required for Ed25519)
ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

export interface KeyPair {
  publicKey: string; // hex
  secretKey: string; // hex
}

export function generateKeyPair(): KeyPair {
  const secretKey = randomBytes(32);
  const publicKey = ed25519.getPublicKey(secretKey);
  return {
    publicKey: Buffer.from(publicKey).toString("hex"),
    secretKey: Buffer.from(secretKey).toString("hex"),
  };
}

export function sign(message: Uint8Array, secretKeyHex: string): string {
  const secretKey = Buffer.from(secretKeyHex, "hex");
  const sig = ed25519.sign(message, secretKey);
  return Buffer.from(sig).toString("hex");
}

export function verify(
  message: Uint8Array,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  const signature = Buffer.from(signatureHex, "hex");
  const publicKey = Buffer.from(publicKeyHex, "hex");
  return ed25519.verify(signature, message, publicKey);
}

/**
 * Canonicalise an object for signing.
 * Deterministic JSON serialisation (sorted keys at all levels, no whitespace).
 */
export function canonicalise(obj: unknown): Uint8Array {
  const json = JSON.stringify(sortKeysDeep(obj));
  return Buffer.from(json, "utf-8");
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Hash content for attestation.
 * SHA-512 of the content, hex-encoded.
 */
export function contentHash(content: string | Uint8Array): string {
  const bytes =
    typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  const hash = sha512(bytes);
  return Buffer.from(hash).toString("hex");
}

/**
 * Generate a random nonce (32 bytes, hex).
 */
export function generateNonce(): string {
  return Buffer.from(randomBytes(32)).toString("hex");
}
