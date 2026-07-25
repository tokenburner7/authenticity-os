/**
 * @auth/agent — Agent types
 */

import type { IdentityAnchor, SignedCredential } from "@auth/protocol";

export interface AgentProfile {
  id: string;
  name: string;
  /** The human principal this agent represents */
  ownerId: string;
  /** Public-facing description */
  bio: string;
  /** Capabilities the agent can perform */
  capabilities: AgentCapability[];
  createdAt: string;
}

export type AgentCapability =
  | "draft-content"
  | "schedule"
  | "filter-content"
  | "negotiate"
  | "research"
  | "socialise";

export interface AgentMessage {
  id: string;
  from: string; // agent ID
  to: string; // agent ID
  type: AgentMessageType;
  payload: unknown;
  timestamp: string;
  /** Credential proving the sender's identity */
  identityCredential?: SignedCredential;
}

export type AgentMessageType =
  | "handshake"
  | "content-draft"
  | "schedule-request"
  | "negotiation-offer"
  | "negotiation-accept"
  | "negotiation-reject"
  | "reputation-query"
  | "reputation-response"
  | "goodbye";

export interface AgentInteractionRecord {
  id: string;
  fromAgent: string;
  toAgent: string;
  messageType: AgentMessageType;
  timestamp: string;
  outcome: "success" | "failure" | "pending";
}

export interface DelegatedContent {
  /** The content produced by the agent on behalf of the user */
  content: string;
  /** Content hash from the protocol */
  contentHash: string;
  /** The delegation credential signed by the user's identity */
  credential: SignedCredential;
  /** AI assistance level used */
  aiAssistance: "partial" | "ai-assisted" | "fully-ai";
  createdAt: string;
}

export interface AgentWallet {
  /** The identity anchor of the agent's owner */
  ownerAnchor: IdentityAnchor;
  /** Credentials the agent holds on behalf of the owner */
  credentials: SignedCredential[];
  /** Other agents this agent has interacted with (social graph) */
  knownAgents: Map<string, AgentProfile>;
}
