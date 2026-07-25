/**
 * @auth/protocol — W3C Verifiable Credential interop
 *
 * Converts our internal SignedCredential to/from the W3C Verifiable
 * Credentials Data Model (https://www.w3.org/TR/vc-data-model/).
 *
 * The internal representation is optimised for the protocol's signing and
 * verification pipeline; the W3C form is what gets serialised when exporting
 * for interchange with other VC-compatible tooling.
 *
 * Proof format: Ed25519Signature2018 — `proofValue` is the raw Ed25519
 * signature (hex). The original payload `nonce` (which the signature is
 * computed over) is carried as `proof.nonce`, an extension property permitted
 * by the W3C data model. Without it, round-trip signature verification would
 * be impossible, because the nonce is random and not recoverable from the
 * signature itself.
 */

import type {
  SignedCredential,
  CredentialPayload,
  CredentialSubject,
  CredentialType,
  AIAssistanceLevel,
} from "./types.js";

/** W3C @context for Verifiable Credentials. */
const VC_CONTEXT = "https://www.w3.org/2018/credentials/v1";

/** Our own @context extension, carrying the protocol-specific type + AI level. */
const AUTH_CONTEXT = "https://authenticity-os.org/2026/credentials/v1";

/** Ed25519Signature2018 proof type URI. */
const PROOF_TYPE = "Ed25519Signature2018";

/**
 * A W3C Verifiable Credential, faithful enough to the data model to be
 * interoperable while still carrying our protocol-specific fields.
 */
export interface W3CVerifiableCredential {
  "@context": string[];
  id?: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    type?: CredentialType;
    contentHash?: string;
    targetId?: string;
    aiAssistance: AIAssistanceLevel;
    evidence?: string;
    claims?: Record<string, string>;
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofValue: string;
    /** Protocol extension: the nonce the signature was computed over. */
    nonce: string;
  };
}

/**
 * Convert an internal SignedCredential to W3C VC JSON form.
 *
 * `proof.proofValue` carries the original signature (hex); `verificationMethod`
 * carries the signer's public key (hex) — the identity anchor id. `proof.nonce`
 * carries the payload nonce so the round trip can be verified.
 */
export function toW3CVC(credential: SignedCredential): W3CVerifiableCredential {
  const { payload, signature, signer } = credential;
  const subject: CredentialSubject = payload.subject;

  const vc: W3CVerifiableCredential = {
    "@context": [VC_CONTEXT, AUTH_CONTEXT],
    type: ["VerifiableCredential", payload.type],
    issuer: payload.issuer,
    issuanceDate: payload.issuedAt,
    credentialSubject: {
      type: payload.type,
      aiAssistance: subject.aiAssistance,
    },
    proof: {
      type: PROOF_TYPE,
      created: payload.issuedAt,
      verificationMethod: signer,
      proofValue: signature,
      nonce: payload.nonce,
    },
  };

  if (payload.expiresAt) {
    vc.expirationDate = payload.expiresAt;
  }
  if (subject.contentHash !== undefined) {
    vc.credentialSubject.contentHash = subject.contentHash;
  }
  if (subject.targetId !== undefined) {
    vc.credentialSubject.targetId = subject.targetId;
  }
  if (subject.evidence !== undefined) {
    vc.credentialSubject.evidence = subject.evidence;
  }
  if (subject.claims !== undefined) {
    vc.credentialSubject.claims = subject.claims;
  }

  return vc;
}

/**
 * Convert a W3C VC back to our internal SignedCredential.
 *
 * Reconstructs the payload exactly: the canonicalised form of the rebuilt
 * payload will match the canonicalised form of the original, so
 * `verifyCredentialSignature(fromW3CVC(toW3CVC(c))) === true`.
 */
export function fromW3CVC(vc: W3CVerifiableCredential): SignedCredential {
  const subjectIn = vc.credentialSubject;

  const type: CredentialType =
    (subjectIn.type as CredentialType | undefined) ??
    (vc.type.find((t) => t !== "VerifiableCredential") as
      | CredentialType
      | undefined) ??
    "identity";

  const subject: CredentialSubject = {
    aiAssistance: subjectIn.aiAssistance,
  };
  if (subjectIn.contentHash !== undefined) {
    subject.contentHash = subjectIn.contentHash;
  }
  if (subjectIn.targetId !== undefined) {
    subject.targetId = subjectIn.targetId;
  }
  if (subjectIn.evidence !== undefined) {
    subject.evidence = subjectIn.evidence;
  }
  if (subjectIn.claims !== undefined) {
    subject.claims = subjectIn.claims;
  }

  const payload: CredentialPayload = {
    type,
    issuer: vc.issuer,
    subject,
    issuedAt: vc.issuanceDate,
    nonce: vc.proof.nonce,
  };
  if (vc.expirationDate !== undefined) {
    payload.expiresAt = vc.expirationDate;
  }

  return {
    payload,
    signature: vc.proof.proofValue,
    signer: vc.proof.verificationMethod,
  };
}
