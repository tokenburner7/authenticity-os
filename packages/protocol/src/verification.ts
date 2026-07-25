/**
 * @auth/protocol — Verification engine
 *
 * The public API: verify a credential's authenticity, signature,
 * and issuer reputation in one call.
 */

import type {
  SignedCredential,
  VerificationResult,
  VerificationStatus,
} from "./types.js";
import { verifyCredentialSignature, isExpired } from "./credentials.js";
import type { ReputationStore } from "./reputation.js";
import { getReputation } from "./reputation.js";

export interface VerifyOptions {
  /** Minimum reputation score for the issuer (0-100) */
  minReputation?: number;
}

export function verifyCredential(
  credential: SignedCredential,
  reputationStore: ReputationStore,
  options: VerifyOptions = {}
): VerificationResult {
  const verifiedAt = new Date().toISOString();

  // 1. Signature check
  if (!verifyCredentialSignature(credential)) {
    return {
      status: "invalid-signature",
      message: "Signature does not match payload.",
      verifiedAt,
    };
  }

  // 2. Expiry check
  if (isExpired(credential)) {
    return {
      status: "expired",
      credential,
      message: "Credential has expired.",
      verifiedAt,
    };
  }

  // 3. Reputation check
  const reputation = getReputation(reputationStore, credential.signer);
  if (options.minReputation !== undefined) {
    if (!reputation || reputation.overall < options.minReputation) {
      const status: VerificationStatus = reputation
        ? "low-reputation"
        : "unknown-issuer";
      return {
        status,
        credential,
        reputation,
        message: reputation
          ? `Issuer reputation ${reputation.overall} below threshold ${options.minReputation}.`
          : "Issuer has no reputation record.",
        verifiedAt,
      };
    }
  }

  return {
    status: "valid",
    credential,
    reputation,
    message: "Credential is valid and issuer reputation meets threshold.",
    verifiedAt,
  };
}
