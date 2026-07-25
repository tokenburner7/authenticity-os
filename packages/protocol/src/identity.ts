/**
 * @auth/protocol — Identity management
 *
 * Create and manage identity anchors — the root identity layer.
 * Each identity is an Ed25519 keypair with an associated assurance level.
 */

import type { AssuranceLevel, IdentityAnchor } from "./types.js";
import { generateKeyPair } from "./crypto.js";

export interface Identity extends IdentityAnchor {
  /** Private key — only stored on the user's device */
  secretKey: string;
}

export function createIdentity(
  handle: string,
  assurance: AssuranceLevel = "peer"
): Identity {
  const keys = generateKeyPair();
  return {
    id: keys.publicKey,
    secretKey: keys.secretKey,
    handle,
    assurance,
    createdAt: new Date().toISOString(),
  };
}

export function toAnchor(identity: Identity): IdentityAnchor {
  const { secretKey: _, ...anchor } = identity;
  return anchor;
}

/**
 * Upgrade the assurance level of an identity.
 * Returns a new identity object (immutable).
 */
export function upgradeAssurance(
  identity: Identity,
  newAssurance: AssuranceLevel
): Identity {
  const order: AssuranceLevel[] = ["peer", "social", "biometric", "government"];
  const currentIdx = order.indexOf(identity.assurance);
  const newIdx = order.indexOf(newAssurance);
  if (newIdx <= currentIdx) {
    return identity;
  }
  return { ...identity, assurance: newAssurance };
}
