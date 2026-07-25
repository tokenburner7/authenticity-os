/**
 * @auth/protocol — Reputation graph
 *
 * Tracks reputation scores per identity, computed from on-protocol behaviour.
 * v0.1: in-memory store. v0.2 will add persistence.
 */

import type {
  ReputationRecord,
  ReputationDimension,
  SignedCredential,
} from "./types.js";

export interface ReputationStore {
  records: Map<string, ReputationRecord>;
  /** Credentials that contribute to reputation (indexed by issuer) */
  vouches: Map<string, SignedCredential[]>;
}

export function createReputationStore(): ReputationStore {
  return {
    records: new Map(),
    vouches: new Map(),
  };
}

export function getReputation(
  store: ReputationStore,
  identityId: string
): ReputationRecord | undefined {
  return store.records.get(identityId);
}

/**
 * Record a vouch credential and update reputation.
 * Each vouch adds to the target's "social-trust" dimension.
 */
export function recordVouch(
  store: ReputationStore,
  vouch: SignedCredential
): void {
  const targetId = vouch.payload.subject.targetId;
  if (!targetId) return;

  const existing = store.vouches.get(targetId) ?? [];
  existing.push(vouch);
  store.vouches.set(targetId, existing);

  updateScore(store, targetId);
}

/**
 * Calculate reputation from vouch count and issuer reputation.
 * v0.1: simple count-based. Each vouch from a reputable source adds weight.
 * v0.2: stake-weighted, with slashing.
 */
function updateScore(
  store: ReputationStore,
  identityId: string
): void {
  const vouches = store.vouches.get(identityId) ?? [];
  const vouchCount = vouches.length;

  // Simple reputation: more vouches = higher score, diminishing returns
  const socialScore = Math.min(
    100,
    Math.round(100 * (1 - Math.exp(-vouchCount / 5)))
  );

  const dimensions: ReputationDimension[] = [
    {
      dimension: "social-trust",
      score: socialScore,
      sampleSize: vouchCount,
      updatedAt: new Date().toISOString(),
    },
  ];

  store.records.set(identityId, {
    identityId,
    dimensions,
    overall: socialScore,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Slash reputation — penalise a false claim.
 * v0.1: sets reputation to 0. v0.2: stake slashing with economic penalties.
 */
export function slashReputation(
  store: ReputationStore,
  identityId: string,
  _reason: string
): void {
  const existing = store.records.get(identityId);
  const dimensions: ReputationDimension[] = [
    {
      dimension: "social-trust",
      score: 0,
      sampleSize: existing?.dimensions[0]?.sampleSize ?? 0,
      updatedAt: new Date().toISOString(),
    },
  ];
  store.records.set(identityId, {
    identityId,
    dimensions,
    overall: 0,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Check if an identity meets a minimum reputation threshold.
 */
export function meetsThreshold(
  store: ReputationStore,
  identityId: string,
  threshold: number
): boolean {
  const record = store.records.get(identityId);
  if (!record) return false;
  return record.overall >= threshold;
}
