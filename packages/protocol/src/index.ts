/**
 * @auth/protocol — Public API
 *
 * The authenticity protocol: portable, reputation-weighted credentials
 * for verifiable human authenticity.
 *
 * Architecture:
 *   Layer 1: Identity anchors (Ed25519 keypairs, assurance levels)
 *   Layer 2: Creation attestation (sign content with your identity)
 *   Layer 3: Reputation graph (vouch-weighted trust scores)
 *   Layer 4: Verification API (anyone can verify any credential)
 */

// Types
export type {
  AssuranceLevel,
  IdentityAnchor,
  CredentialType,
  AIAssistanceLevel,
  CredentialSubject,
  CredentialPayload,
  SignedCredential,
  ReputationDimension,
  ReputationRecord,
  Stake,
  VerificationStatus,
  VerificationResult,
} from "./types.js";

// Crypto
export {
  generateKeyPair,
  sign,
  verify,
  canonicalise,
  contentHash,
  generateNonce,
  type KeyPair,
} from "./crypto.js";

// Identity
export {
  createIdentity,
  toAnchor,
  upgradeAssurance,
  type Identity,
} from "./identity.js";

// Credentials
export {
  createPayload,
  issueCredential,
  verifyCredentialSignature,
  isExpired,
  attestCreation,
  vouchFor,
  delegateCreation,
} from "./credentials.js";

// Reputation
export {
  createReputationStore,
  getReputation,
  recordVouch,
  slashReputation,
  meetsThreshold,
  type ReputationStore,
} from "./reputation.js";

// Verification
export {
  verifyCredential,
  type VerifyOptions,
} from "./verification.js";
