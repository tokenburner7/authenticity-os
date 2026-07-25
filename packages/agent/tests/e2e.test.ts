/**
 * End-to-end integration test: agent layer
 *
 * Full flow: create identity → create agent → draft content →
 * handshake → share content → verify → persistence
 */

import { describe, it, expect } from "vitest";
import {
  createAgent,
  createAgentForIdentity,
  createMessageBus,
  handshake,
  shareContentDraft,
  getMessagesFor,
  MockProvider,
  SqliteAgentStore,
} from "../src/index.js";
import {
  createIdentity,
  verifyCredentialSignature,
  createReputationStore,
  vouchFor,
  recordVouch,
  verifyCredential,
} from "@auth/protocol";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

describe("agent e2e", () => {
  it("full lifecycle: identity → agent → draft → handshake → verify", () => {
    // 1. Create identities
    const aliceId = createIdentity("alice", "peer");
    const bobId = createIdentity("bob", "peer");

    // 2. Create agents
    const alice = createAgentForIdentity(
      { name: "Alice Agent", bio: "Alice's digital representative", capabilities: ["draft-content"] },
      aliceId
    );
    const bob = createAgentForIdentity(
      { name: "Bob Agent", bio: "Bob's agent", capabilities: ["draft-content"] },
      bobId
    );

    // 3. Alice's agent drafts content
    const draft = alice.draftContent("My thoughts on AI authenticity", "ai-assisted");
    expect(verifyCredentialSignature(draft.credential)).toBe(true);

    // 4. Create message bus and handshake
    const bus = createMessageBus();
    handshake(bus, alice.profile, bob.profile.id);

    // 5. Alice shares content draft with Bob
    shareContentDraft(bus, alice.profile.id, bob.profile.id, draft.content, draft.contentHash);

    // 6. Bob receives the content
    const bobMessages = getMessagesFor(bus, bob.profile.id);
    expect(bobMessages).toHaveLength(2); // handshake + content-draft

    const contentMsg = bobMessages.find(m => m.type === "content-draft");
    expect(contentMsg).toBeDefined();
    expect((contentMsg!.payload as { content: string }).content).toBe("My thoughts on AI authenticity");

    // 7. Bob verifies Alice's credential
    const result = verifyCredentialSignature(draft.credential);
    expect(result).toBe(true);

    // 8. Alice learns about Bob (social graph)
    alice.learnAgent(bob.profile);
    alice.recordInteraction(bob.profile.id);
    expect(alice.getKnownAgents()).toHaveLength(1);
    expect(alice.getInteractionCount(bob.profile.id)).toBe(1);
  });

  it("LLM-backed generation produces signed content", async () => {
    const identity = createIdentity("alice", "peer");
    const agent = createAgentForIdentity(
      { name: "Alice Agent", bio: "", capabilities: ["draft-content"] },
      identity
    );

    agent.setLLMProvider(new MockProvider());

    const draft = await agent.generateContent("Write about authenticity", "ai-assisted");
    expect(draft.content).toContain("Generated content for: Write about authenticity");
    expect(verifyCredentialSignature(draft.credential)).toBe(true);
    expect(draft.credential.payload.type).toBe("delegation");
    expect(draft.credential.payload.subject.aiAssistance).toBe("ai-assisted");
  });

  it("reputation gates content verification in agent interactions", () => {
    const aliceId = createIdentity("alice", "peer");
    const bobId = createIdentity("bob", "peer");
    const carolId = createIdentity("carol", "peer");

    // Build Carol's reputation
    const repStore = createReputationStore();
    recordVouch(repStore, vouchFor(aliceId, carolId.id));
    recordVouch(repStore, vouchFor(bobId, carolId.id));

    // Carol's agent attests content
    const carol = createAgentForIdentity(
      { name: "Carol Agent", bio: "", capabilities: [] },
      carolId
    );
    const cred = carol.attestHumanContent("My original content");

    // Verify with reputation threshold — should pass
    const result = verifyCredential(cred, repStore, { minReputation: 10 });
    expect(result.status).toBe("valid");
  });

  it("agent state persists across save/load with SQLite", () => {
    const dbPath = join(tmpdir(), `auth-agent-e2e-${Date.now()}-${Math.random()}.db`);

    const alice = createAgent({
      name: "Alice Agent",
      bio: "Test",
      capabilities: ["draft-content"],
    });
    const bob = createAgent({
      name: "Bob Agent",
      bio: "",
      capabilities: [],
    });

    // Build up state
    alice.draftContent("content one", "ai-assisted");
    alice.draftContent("content two", "fully-ai");
    alice.learnAgent(bob.profile);
    alice.recordInteraction(bob.profile.id);
    alice.recordInteraction(bob.profile.id);

    // Save
    const store = new SqliteAgentStore(dbPath);
    alice.save(store);
    store.close();

    // Restore into a new agent with the same identity
    const store2 = new SqliteAgentStore(dbPath);
    const alice2 = createAgentForIdentity(
      { name: "Alice Agent", bio: "Test", capabilities: ["draft-content"] },
      alice.identity
    );
    alice2.loadState(store2);

    // Verify
    expect(alice2.getWallet().credentials).toHaveLength(2);
    expect(alice2.getKnownAgents()).toHaveLength(1);
    expect(alice2.getKnownAgents()[0].name).toBe("Bob Agent");
    expect(alice2.getInteractionCount(bob.profile.id)).toBe(2);

    store2.close();
    rmSync(dbPath, { force: true });
  });
});