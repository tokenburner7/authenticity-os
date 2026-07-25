/**
 * @auth/agent — Identity wallet
 *
 * The agent's wallet stores the user's identity anchor and credentials.
 * This is the portable identity store — it moves with the agent.
 *
 * v0.1: in-memory. v0.2: encrypted local persistence.
 */

import type { IdentityAnchor, SignedCredential } from "@auth/protocol";
import type { AgentProfile } from "./types.js";

export interface AgentWallet {
  ownerAnchor: IdentityAnchor;
  credentials: SignedCredential[];
  knownAgents: Map<string, AgentProfile>;
}

export function createWallet(anchor: IdentityAnchor): AgentWallet {
  return {
    ownerAnchor: anchor,
    credentials: [],
    knownAgents: new Map(),
  };
}

export function addCredential(
  wallet: AgentWallet,
  credential: SignedCredential
): void {
  wallet.credentials.push(credential);
}

export function getCredentials(wallet: AgentWallet): SignedCredential[] {
  return [...wallet.credentials];
}

export function addKnownAgent(
  wallet: AgentWallet,
  profile: AgentProfile
): void {
  wallet.knownAgents.set(profile.id, profile);
}

export function getKnownAgent(
  wallet: AgentWallet,
  agentId: string
): AgentProfile | undefined {
  return wallet.knownAgents.get(agentId);
}
