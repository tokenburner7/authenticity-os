import { describe, it, expect } from "vitest";
import {
  createAgent,
  createMessageBus,
  handshake,
  queryReputation,
  respondReputation,
  shareContentDraft,
  getMessagesFor,
  getMessagesFrom,
  subscribe,
} from "../src/index.js";

describe("agent-to-agent communication", () => {
  it("initiates a handshake between two agents", () => {
    const bus = createMessageBus();
    const alice = createAgent({
      name: "Alice Agent",
      bio: "Alice's agent",
      capabilities: ["draft-content", "negotiate"],
    });
    const bob = createAgent({
      name: "Bob Agent",
      bio: "Bob's agent",
      capabilities: ["draft-content"],
    });

    const msg = handshake(bus, alice.profile, bob.profile.id);
    expect(msg.type).toBe("handshake");
    expect(msg.from).toBe(alice.profile.id);
    expect(msg.to).toBe(bob.profile.id);
    expect((msg.payload as { profile: { name: string } }).profile.name).toBe("Alice Agent");
  });

  it("queries and responds with reputation", () => {
    const bus = createMessageBus();
    const alice = createAgent({
      name: "Alice Agent",
      bio: "",
      capabilities: [],
    });
    const bob = createAgent({
      name: "Bob Agent",
      bio: "",
      capabilities: [],
    });

    const query = queryReputation(bus, alice.profile.id, bob.profile.id);
    expect(query.type).toBe("reputation-query");

    const response = respondReputation(
      bus,
      bob.profile.id,
      alice.profile.id,
      { overall: 75 }
    );
    expect(response.type).toBe("reputation-response");
  });

  it("shares a content draft between agents", () => {
    const bus = createMessageBus();
    const alice = createAgent({
      name: "Alice Agent",
      bio: "",
      capabilities: ["draft-content"],
    });
    const bob = createAgent({
      name: "Bob Agent",
      bio: "",
      capabilities: ["draft-content"],
    });

    const draft = alice.draftContent("Collaborative post", "ai-assisted");
    const msg = shareContentDraft(
      bus,
      alice.profile.id,
      bob.profile.id,
      draft.content,
      draft.contentHash
    );

    expect(msg.type).toBe("content-draft");
    expect((msg.payload as { content: string }).content).toBe("Collaborative post");
  });

  it("delivers messages via subscription", () => {
    const bus = createMessageBus();
    const alice = createAgent({
      name: "Alice Agent",
      bio: "",
      capabilities: [],
    });
    const bob = createAgent({
      name: "Bob Agent",
      bio: "",
      capabilities: [],
    });

    const received: string[] = [];
    subscribe(bus, bob.profile.id, (msg) => {
      received.push(msg.type);
    });

    handshake(bus, alice.profile, bob.profile.id);
    expect(received).toContain("handshake");
  });

  it("filters messages by sender and recipient", () => {
    const bus = createMessageBus();
    const alice = createAgent({
      name: "Alice Agent",
      bio: "",
      capabilities: [],
    });
    const bob = createAgent({
      name: "Bob Agent",
      bio: "",
      capabilities: [],
    });

    handshake(bus, alice.profile, bob.profile.id);
    queryReputation(bus, alice.profile.id, bob.profile.id);

    const aliceSent = getMessagesFrom(bus, alice.profile.id);
    const bobReceived = getMessagesFor(bus, bob.profile.id);

    expect(aliceSent).toHaveLength(2);
    expect(bobReceived).toHaveLength(2);
  });
});
