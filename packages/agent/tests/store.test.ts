import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SqliteAgentStore,
  createAgent,
  createAgentForIdentity,
  type AgentStore,
} from "../src/index.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

describe("Agent SQLite store", () => {
  let store: AgentStore;
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(tmpdir(), `auth-agent-test-${Date.now()}-${Math.random()}.db`);
    store = new SqliteAgentStore(dbPath);
  });

  afterEach(() => {
    store.close();
    rmSync(dbPath, { force: true });
  });

  describe("profile", () => {
    it("saves and loads a profile", () => {
      const agent = createAgent({
        name: "Alice's Agent",
        bio: "Personal agent",
        capabilities: ["draft-content", "schedule"],
      });

      store.saveProfile(agent.profile);
      const loaded = store.loadProfile(agent.profile.id);

      expect(loaded).toBeDefined();
      expect(loaded!.name).toBe("Alice's Agent");
      expect(loaded!.capabilities).toContain("draft-content");
      expect(loaded!.ownerId).toBe(agent.profile.ownerId);
    });

    it("returns undefined for unknown profile", () => {
      expect(store.loadProfile("nonexistent")).toBeUndefined();
    });
  });

  describe("wallet credentials", () => {
    it("saves and loads credentials for an agent", () => {
      const agent = createAgent({
        name: "Test Agent",
        bio: "",
        capabilities: [],
      });

      const draft1 = agent.draftContent("content 1", "ai-assisted");
      const draft2 = agent.draftContent("content 2", "fully-ai");

      store.saveCredential(agent.profile.id, draft1.credential);
      store.saveCredential(agent.profile.id, draft2.credential);

      const loaded = store.loadCredentials(agent.profile.id);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].payload.subject.contentHash).toBeDefined();
      expect(loaded[1].payload.subject.aiAssistance).toBe("fully-ai");
    });

    it("returns empty for agent with no credentials", () => {
      expect(store.loadCredentials("unknown")).toHaveLength(0);
    });
  });

  describe("social graph", () => {
    it("saves and loads known agents", () => {
      const alice = createAgent({
        name: "Alice Agent",
        bio: "",
        capabilities: [],
      });
      const bob = createAgent({
        name: "Bob Agent",
        bio: "",
        capabilities: ["draft-content"],
      });

      store.saveKnownAgent(alice.profile.id, bob.profile);

      const known = store.loadKnownAgents(alice.profile.id);
      expect(known).toHaveLength(1);
      expect(known[0].name).toBe("Bob Agent");
      expect(known[0].capabilities).toContain("draft-content");
    });

    it("handles multiple known agents", () => {
      const alice = createAgent({ name: "Alice", bio: "", capabilities: [] });
      const bob = createAgent({ name: "Bob", bio: "", capabilities: [] });
      const carol = createAgent({ name: "Carol", bio: "", capabilities: [] });

      store.saveKnownAgent(alice.profile.id, bob.profile);
      store.saveKnownAgent(alice.profile.id, carol.profile);

      const known = store.loadKnownAgents(alice.profile.id);
      expect(known).toHaveLength(2);
    });
  });

  describe("interaction log", () => {
    it("records and counts interactions", () => {
      const aliceId = "alice-id";
      const bobId = "bob-id";

      store.recordInteraction(aliceId, bobId);
      store.recordInteraction(aliceId, bobId);
      store.recordInteraction(aliceId, "carol-id");

      const counts = store.getInteractionCounts(aliceId);
      expect(counts.get(bobId)).toBe(2);
      expect(counts.get("carol-id")).toBe(1);
    });

    it("returns empty map for agent with no interactions", () => {
      const counts = store.getInteractionCounts("unknown");
      expect(counts.size).toBe(0);
    });
  });

  describe("full save/load round-trip", () => {
    it("agent state survives save and restore", () => {
      const alice = createAgent({
        name: "Alice Agent",
        bio: "Test bio",
        capabilities: ["draft-content"],
      });

      const bob = createAgent({
        name: "Bob Agent",
        bio: "",
        capabilities: [],
      });

      // Build up state
      alice.draftContent("some content", "ai-assisted");
      alice.learnAgent(bob.profile);
      alice.recordInteraction(bob.profile.id);

      // Save
      alice.save(store);
      store.close();

      // Reopen
      const store2 = new SqliteAgentStore(dbPath);

      // Create a new agent bound to the SAME identity, load state
      const alice2 = createAgentForIdentity(
        {
          name: "Alice Agent",
          bio: "Test bio",
          capabilities: ["draft-content"],
        },
        alice.identity
      );
      alice2.loadState(store2);

      // Verify
      const wallet = alice2.getWallet();
      expect(wallet.credentials).toHaveLength(1);
      expect(wallet.credentials[0].payload.subject.contentHash).toBeDefined();

      const known = alice2.getKnownAgents();
      expect(known).toHaveLength(1);
      expect(known[0].name).toBe("Bob Agent");

      expect(alice2.getInteractionCount(bob.profile.id)).toBe(1);

      store2.close();
    });
  });
});