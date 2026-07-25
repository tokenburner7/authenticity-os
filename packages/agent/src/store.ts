/**
 * @auth/agent — Persistence store interface
 *
 * Defines the storage contract for agent state.
 * The agent's wallet, social graph, and interaction log
 * all persist through this interface.
 */

import type { AgentProfile } from "./types.js";
import type { SignedCredential } from "@auth/protocol";

export interface AgentStore {
  // Profile
  saveProfile(profile: AgentProfile): void;
  loadProfile(agentId: string): AgentProfile | undefined;

  // Wallet credentials
  saveCredential(agentId: string, credential: SignedCredential): void;
  loadCredentials(agentId: string): SignedCredential[];

  // Social graph
  saveKnownAgent(agentId: string, profile: AgentProfile): void;
  loadKnownAgents(agentId: string): AgentProfile[];

  // Interaction log
  recordInteraction(agentId: string, otherAgentId: string): void;
  getInteractionCounts(agentId: string): Map<string, number>;

  close(): void;
}
