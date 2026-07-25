/**
 * @auth/agent — Agent-to-agent communication
 *
 * The viral engine. Agents interact with each other on behalf of
 * their human principals. Each interaction creates value for both
 * parties and drives adoption.
 *
 * v0.1: in-memory message bus. v0.2: networked (A2A protocol).
 */

import type { SignedCredential } from "@auth/protocol";
import type {
  AgentMessage,
  AgentMessageType,
  AgentProfile,
} from "./types.js";
import { generateId } from "./utils.js";

export interface MessageBus {
  messages: AgentMessage[];
  subscribers: Map<string, (msg: AgentMessage) => void>;
}

export function createMessageBus(): MessageBus {
  return {
    messages: [],
    subscribers: new Map(),
  };
}

export function sendMessage(
  bus: MessageBus,
  from: string,
  to: string,
  type: AgentMessageType,
  payload: unknown,
  identityCredential?: SignedCredential
): AgentMessage {
  const message: AgentMessage = {
    id: generateId(),
    from,
    to,
    type,
    payload,
    timestamp: new Date().toISOString(),
    identityCredential,
  };
  bus.messages.push(message);
  const callback = bus.subscribers.get(to);
  if (callback) callback(message);
  return message;
}

export function subscribe(
  bus: MessageBus,
  agentId: string,
  callback: (msg: AgentMessage) => void
): void {
  bus.subscribers.set(agentId, callback);
}

/**
 * Initiate a handshake between two agents.
 * Exchanges identity information and establishes trust.
 */
export function handshake(
  bus: MessageBus,
  fromAgent: AgentProfile,
  toAgentId: string,
  identityCredential?: SignedCredential
): AgentMessage {
  return sendMessage(
    bus,
    fromAgent.id,
    toAgentId,
    "handshake",
    { profile: fromAgent },
    identityCredential
  );
}

/**
 * Query another agent's reputation.
 * v0.1: returns the queried agent's identity credential.
 */
export function queryReputation(
  bus: MessageBus,
  fromAgentId: string,
  toAgentId: string
): AgentMessage {
  return sendMessage(
    bus,
    fromAgentId,
    toAgentId,
    "reputation-query",
    { query: "reputation" }
  );
}

/**
 * Respond to a reputation query.
 */
export function respondReputation(
  bus: MessageBus,
  fromAgentId: string,
  toAgentId: string,
  reputation: unknown
): AgentMessage {
  return sendMessage(
    bus,
    fromAgentId,
    toAgentId,
    "reputation-response",
    { reputation }
  );
}

/**
 * Send a content draft to another agent for review/collaboration.
 */
export function shareContentDraft(
  bus: MessageBus,
  fromAgentId: string,
  toAgentId: string,
  content: string,
  contentHash: string
): AgentMessage {
  return sendMessage(
    bus,
    fromAgentId,
    toAgentId,
    "content-draft",
    { content, contentHash }
  );
}

export function getMessagesFor(
  bus: MessageBus,
  agentId: string
): AgentMessage[] {
  return bus.messages.filter((m) => m.to === agentId);
}

export function getMessagesFrom(
  bus: MessageBus,
  agentId: string
): AgentMessage[] {
  return bus.messages.filter((m) => m.from === agentId);
}
