import { describe, it, expect } from "vitest";
import {
  createAgent,
  createAgentForIdentity,
} from "../src/index.js";
import {
  createIdentity as createProtoIdentity,
  contentHash,
  verifyCredentialSignature,
} from "@auth/protocol";

describe("agent", () => {
  it("creates an agent with an identity", () => {
    const agent = createAgent({
      name: "Alice's Agent",
      bio: "Personal AI agent for Alice",
      capabilities: ["draft-content", "schedule", "filter-content"],
    });

    expect(agent.profile.name).toBe("Alice's Agent");
    expect(agent.profile.capabilities).toContain("draft-content");
    expect(agent.profile.id).toMatch(/^[0-9a-f]{64}$/);
    expect(agent.profile.ownerId).toBe(agent.profile.id);
  });

  it("drafts content with a signed delegation credential", () => {
    const agent = createAgent({
      name: "Test Agent",
      bio: "Test",
      capabilities: ["draft-content"],
    });

    const draft = agent.draftContent("Hello world post", "ai-assisted", "agent-v1");

    expect(draft.content).toBe("Hello world post");
    expect(draft.contentHash).toBe(contentHash("Hello world post"));
    expect(draft.aiAssistance).toBe("ai-assisted");
    expect(draft.credential.payload.type).toBe("delegation");
    expect(draft.credential.payload.subject.aiAssistance).toBe("ai-assisted");
    expect(verifyCredentialSignature(draft.credential)).toBe(true);
  });

  it("attests human-created content", () => {
    const agent = createAgent({
      name: "Test Agent",
      bio: "Test",
      capabilities: [],
    });

    const cred = agent.attestHumanContent("I wrote this myself", "manual");
    expect(cred.payload.type).toBe("delegation");
    expect(cred.payload.subject.aiAssistance).toBe("none");
    expect(verifyCredentialSignature(cred)).toBe(true);
  });

  it("can be bound to an existing identity", () => {
    const identity = createProtoIdentity("existing-user", "social");
    const agent = createAgentForIdentity(
      {
        name: "Bound Agent",
        bio: "Bound to existing identity",
        capabilities: ["draft-content"],
      },
      identity
    );

    expect(agent.profile.id).toBe(identity.id);
    expect(agent.profile.ownerId).toBe(identity.id);
  });

  it("records interactions and tracks the social graph", () => {
    const agent = createAgent({
      name: "Agent A",
      bio: "Test",
      capabilities: [],
    });

    const other = createAgent({
      name: "Agent B",
      bio: "Test",
      capabilities: [],
    });

    agent.recordInteraction(other.profile.id);
    agent.recordInteraction(other.profile.id);
    expect(agent.getInteractionCount(other.profile.id)).toBe(2);

    agent.learnAgent(other.profile);
    expect(agent.getKnownAgents()).toHaveLength(1);
    expect(agent.getKnownAgents()[0].name).toBe("Agent B");
  });
});
