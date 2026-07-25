/**
 * @auth/agent — Agent core
 *
 * The personal AI agent. Trained on user data, represents the user
 * in digital interactions, and carries their identity credentials.
 *
 * v0.1: deterministic content drafting (no LLM integration yet).
 * v0.2: LLM-backed drafting, preference learning, correction loops.
 */

import type {
  Identity,
  SignedCredential,
  AIAssistanceLevel,
} from "@auth/protocol";
import {
  createIdentity,
  contentHash,
  delegateCreation,
} from "@auth/protocol";
import type { AgentProfile, AgentCapability, DelegatedContent } from "./types.js";
import type { AgentWallet } from "./wallet.js";
import type { AgentStore } from "./store.js";
import type { LLMProvider } from "./llm.js";

export interface AgentConfig {
  name: string;
  bio: string;
  capabilities: AgentCapability[];
}

export class Agent {
  readonly profile: AgentProfile;
  readonly identity: Identity;
  private wallet: AgentWallet;
  private interactionLog: Map<string, number> = new Map();
  private llmProvider: LLMProvider | null = null;

  constructor(config: AgentConfig, ownerIdentity: Identity) {
    this.identity = ownerIdentity;
    this.profile = {
      id: ownerIdentity.id,
      name: config.name,
      ownerId: ownerIdentity.id,
      bio: config.bio,
      capabilities: config.capabilities,
      createdAt: new Date().toISOString(),
    };
    this.wallet = {
      ownerAnchor: {
        id: ownerIdentity.id,
        handle: ownerIdentity.handle,
        assurance: ownerIdentity.assurance,
        createdAt: ownerIdentity.createdAt,
      },
      credentials: [],
      knownAgents: new Map(),
    };
  }

  /**
   * Draft content on behalf of the user.
   * Returns the content with a signed delegation credential.
   *
   * v0.1: deterministic templates. v0.2: LLM-backed generation.
   */
  draftContent(
    content: string,
    aiAssistance: AIAssistanceLevel = "ai-assisted",
    evidence?: string
  ): DelegatedContent {
    const hash = contentHash(content);
    const credential = delegateCreation(
      this.identity,
      hash,
      aiAssistance,
      evidence
    );

    // Store the credential in the wallet
    this.wallet.credentials.push(credential);

    return {
      content,
      contentHash: hash,
      credential,
      aiAssistance: aiAssistance as "partial" | "ai-assisted" | "fully-ai",
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Install an LLM provider to enable AI-backed content generation.
   * Without a provider, generateContent() will throw.
   */
  setLLMProvider(provider: LLMProvider): void {
    this.llmProvider = provider;
  }

  /**
   * Generate content via the configured LLM provider, then draft and sign it.
   * Throws if no provider has been set via setLLMProvider().
   *
   * Default aiAssistance is "fully-ai" since the content is model-generated.
   */
  async generateContent(
    prompt: string,
    aiAssistance: AIAssistanceLevel = "fully-ai",
    evidence?: string
  ): Promise<DelegatedContent> {
    if (!this.llmProvider) {
      throw new Error(
        "No LLM provider set. Call setLLMProvider() before generateContent()."
      );
    }
    const content = await this.llmProvider.generate(prompt);
    return this.draftContent(content, aiAssistance, evidence);
  }

  /**
   * Attest that the user created a piece of content directly (no AI).
   * The agent signs on behalf of the user with aiAssistance: "none".
   */
  attestHumanContent(
    content: string,
    evidence?: string
  ): SignedCredential {
    const hash = contentHash(content);
    return delegateCreation(this.identity, hash, "none", evidence);
  }

  getWallet(): AgentWallet {
    return this.wallet;
  }

  /**
   * Record an interaction with another agent.
   * This builds the social graph — the network effect engine.
   */
  recordInteraction(agentId: string): void {
    const count = this.interactionLog.get(agentId) ?? 0;
    this.interactionLog.set(agentId, count + 1);
  }

  getInteractionCount(agentId: string): number {
    return this.interactionLog.get(agentId) ?? 0;
  }

  /**
   * Learn about another agent (add to social graph).
   */
  learnAgent(profile: AgentProfile): void {
    this.wallet.knownAgents.set(profile.id, profile);
  }

  getKnownAgents(): AgentProfile[] {
    return Array.from(this.wallet.knownAgents.values());
  }

  // ── Persistence ──────────────────────────────────────────

  /**
   * Save the agent's full state to an AgentStore.
   * Persists: profile, wallet credentials, social graph, interaction log.
   */
  save(store: AgentStore): void {
    store.saveProfile(this.profile);

    // Save wallet credentials
    for (const credential of this.wallet.credentials) {
      store.saveCredential(this.profile.id, credential);
    }

    // Save social graph
    for (const knownAgent of Array.from(this.wallet.knownAgents.values())) {
      store.saveKnownAgent(this.profile.id, knownAgent);
    }

    // Save interaction log
    for (const [otherId, count] of Array.from(this.interactionLog)) {
      for (let i = 0; i < count; i++) {
        store.recordInteraction(this.profile.id, otherId);
      }
    }
  }

  /**
   * Restore wallet credentials and social graph from an AgentStore.
   * Does NOT restore the profile (the Agent already has one from construction).
   */
  loadState(store: AgentStore): void {
    // Restore credentials
    const credentials = store.loadCredentials(this.profile.id);
    this.wallet.credentials.push(...credentials);

    // Restore social graph
    const knownAgents = store.loadKnownAgents(this.profile.id);
    for (const agent of knownAgents) {
      this.wallet.knownAgents.set(agent.id, agent);
    }

    // Restore interaction log
    const counts = store.getInteractionCounts(this.profile.id);
    for (const [otherId, count] of Array.from(counts)) {
      this.interactionLog.set(otherId, count);
    }
  }
}

/**
 * Create a new agent for a user.
 * The agent inherits the user's identity — it IS the user's digital representative.
 */
export function createAgent(config: AgentConfig): Agent {
  const identity = createIdentity(config.name, "peer");
  return new Agent(config, identity);
}

/**
 * Create an agent bound to an existing identity.
 * Use this when the user already has an identity anchor.
 */
export function createAgentForIdentity(
  config: AgentConfig,
  identity: Identity
): Agent {
  return new Agent(config, identity);
}
