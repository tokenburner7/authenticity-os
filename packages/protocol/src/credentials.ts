/**
 * @auth/protocol — Credential issuance and verification
 *
 * The core protocol operation: sign a claim with your identity,
 * producing a portable credential that anyone can verify.
 */

import type {
  CredentialPayload,
  CredentialType,
  SignedCredential,
  AIAssistanceLevel,
  CredentialSubject,
} from "./types.js";
import { sign, verify, canonicalise, generateNonce } from "./crypto.js";
import type { Identity } from "./identity.js";

export function createPayload(
  type: CredentialType,
  issuerId: string,
  subject: CredentialSubject
): CredentialPayload {
  return {
    type,
    issuer: issuerId,
    subject,
    issuedAt: new Date().toISOString(),
    nonce: generateNonce(),
  };
}

export function issueCredential(
  type: CredentialType,
  issuer: Identity,
  subject: CredentialSubject,
  options?: { expiresIn?: number }
): SignedCredential {
  const payload = createPayload(type, issuer.id, subject);
  if (options?.expiresIn) {
    const expiry = new Date(
      Date.now() + options.expiresIn * 1000
    ).toISOString();
    (payload as CredentialPayload).expiresAt = expiry;
  }
  const message = canonicalise(payload);
  const signature = sign(message, issuer.secretKey);
  return {
    payload,
    signature,
    signer: issuer.id,
  };
}

export function verifyCredentialSignature(
  credential: SignedCredential
): boolean {
  const message = canonicalise(credential.payload);
  return verify(message, credential.signature, credential.signer);
}

export function isExpired(credential: SignedCredential): boolean {
  if (!credential.payload.expiresAt) return false;
  return new Date(credential.payload.expiresAt).getTime() < Date.now();
}

/**
 * Create a content-attestation credential.
 * "I, [identity], created this content, with [AI assistance level]."
 */
export function attestCreation(
  issuer: Identity,
  contentHash: string,
  aiAssistance: AIAssistanceLevel,
  evidence?: string
): SignedCredential {
  return issueCredential("creation", issuer, {
    contentHash,
    aiAssistance,
    evidence,
  });
}

/**
 * Create a vouch credential.
 * "I, [identity], vouch for [target identity]."
 */
export function vouchFor(
  issuer: Identity,
  targetId: string,
  evidence?: string
): SignedCredential {
  return issueCredential("vouch", issuer, {
    targetId,
    aiAssistance: "none",
    evidence,
  });
}

/**
 * Create a delegation credential.
 * "My AI agent created this content on my behalf, with my authorisation."
 */
export function delegateCreation(
  issuer: Identity,
  contentHash: string,
  aiAssistance: AIAssistanceLevel,
  evidence?: string
): SignedCredential {
  return issueCredential("delegation", issuer, {
    contentHash,
    aiAssistance,
    evidence,
  });
}
