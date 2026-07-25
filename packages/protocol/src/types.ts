/**
 * @auth/protocol — Core types
 *
 * The authenticity protocol issues portable, reputation-weighted credentials
 * that prove: "this specific human, with this track record, vouches for
 * this specific piece of content, and here is the evidence."
 */

// ── Identity ────────────────────────────────────────────────────────

export type AssuranceLevel = "peer" | "social" | "biometric" | "government";

export interface IdentityAnchor {
  /** Ed25519 public key, hex-encoded */
  id: string;
  /** Human-readable handle (not unique across the network) */
  handle: string;
  /** How strongly this identity has been verified */
  assurance: AssuranceLevel;
  /** ISO 8601 timestamp of anchor creation */
  createdAt: string;
}

// ── Credentials ────────────────────────────────────────────────────

export type CredentialType =
  | "identity" // "I am a unique human"
  | "creation" // "I created this content"
  | "vouch" // "I vouch for this person/content"
  | "delegation"; // "My AI agent acted on my behalf"

export type AIAssistanceLevel = "none" | "partial" | "ai-assisted" | "fully-ai";

export interface CredentialSubject {
  /** The content hash being attested to (for creation/delegation credentials) */
  contentHash?: string;
  /** The identity being vouched for (for vouch credentials) */
  targetId?: string;
  /** Level of AI involvement in the content */
  aiAssistance: AIAssistanceLevel;
  /** Free-form evidence URI or inline proof */
  evidence?: string;
  /** Custom claims */
  claims?: Record<string, string>;
}

export interface CredentialPayload {
  /** W3C VC-like structure, simplified for v0.1 */
  type: CredentialType;
  issuer: string; // IdentityAnchor.id (public key)
  subject: CredentialSubject;
  issuedAt: string; // ISO 8601
  expiresAt?: string; // ISO 8601
  /** Nonce to prevent replay */
  nonce: string;
}

export interface SignedCredential {
  payload: CredentialPayload;
  /** Ed25519 signature over the canonicalised payload, hex-encoded */
  signature: string;
  /** Public key of the signer, hex-encoded */
  signer: string;
}

// ── Reputation ─────────────────────────────────────────────────────

export interface ReputationDimension {
  /** e.g. "content-creator", "trusted-reviewer", "honest-counterparty" */
  dimension: string;
  /** 0-100 score */
  score: number;
  /** Number of data points feeding this score */
  sampleSize: number;
  /** Last updated ISO 8601 */
  updatedAt: string;
}

export interface ReputationRecord {
  identityId: string;
  dimensions: ReputationDimension[];
  /** Overall trust score 0-100, weighted aggregate */
  overall: number;
  updatedAt: string;
}

// ── Stake / Slashing ───────────────────────────────────────────────

export interface Stake {
  identityId: string;
  /** Amount staked (protocol units) */
  amount: number;
  /** What the stake is backing (credential hash, content hash, etc.) */
  backing: string;
  stakedAt: string;
  /** null if active, ISO 8601 if released */
  releasedAt: string | null;
  /** null if not slashed, reason if slashed */
  slashedReason: string | null;
}

// ── Verification Result ────────────────────────────────────────────

export type VerificationStatus =
  | "valid"
  | "invalid-signature"
  | "expired"
  | "revoked"
  | "low-reputation"
  | "unknown-issuer";

export interface VerificationResult {
  status: VerificationStatus;
  /** The verified credential, if valid */
  credential?: SignedCredential;
  /** Reputation of the issuer at time of verification */
  reputation?: ReputationRecord;
  /** Human-readable explanation */
  message: string;
  verifiedAt: string;
}
