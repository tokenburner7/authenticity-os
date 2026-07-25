/**
 * @auth/agent — Public API
 *
 * Personal AI agent platform with identity wallet, social delegation,
 * and agent-to-agent communication.
 *
 * Architecture:
 *   Component 1: Agent core (represents the user, drafts content, signs with identity)
 *   Component 2: Identity wallet (stores credentials, manages social graph)
 *   Component 3: Agent-to-agent communication (the viral engine)
 *   Component 4: Delegation (transparent AI-assisted content with provenance)
 */

// Types
export type {
  AgentProfile,
  AgentCapability,
  AgentMessage,
  AgentMessageType,
  AgentInteractionRecord,
  DelegatedContent,
} from "./types.js";

// Agent
export {
  Agent,
  createAgent,
  createAgentForIdentity,
  type AgentConfig,
} from "./agent.js";

// Wallet
export {
  createWallet,
  addCredential,
  getCredentials,
  addKnownAgent,
  getKnownAgent,
  type AgentWallet,
} from "./wallet.js";

// Communication
export {
  createMessageBus,
  sendMessage,
  subscribe,
  handshake,
  queryReputation,
  respondReputation,
  shareContentDraft,
  getMessagesFor,
  getMessagesFrom,
  type MessageBus,
} from "./communication.js";

// LLM providers
export {
  type LLMProvider,
  type LLMOptions,
  MockProvider,
  OllamaProvider,
  OpenAIProvider,
} from "./llm.js";

// Utils
export { generateId } from "./utils.js";
