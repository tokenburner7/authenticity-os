import { describe, it, expect, afterEach } from "vitest";
import { NetworkMessageBus } from "../src/index.js";

// Use unique ports per test to avoid EADDRINUSE conflicts. Each test
// increments the base port so parallel test runs don't collide.
let nextPort = 9201;
const allocPort = () => nextPort++;

const buses: NetworkMessageBus[] = [];

afterEach(async () => {
  for (const bus of buses) {
    await bus.stop();
  }
  buses.length = 0;
  // Small grace period so sockets fully close before the next test binds.
  await new Promise((resolve) => setTimeout(resolve, 100));
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("NetworkMessageBus", () => {
  it("delivers a message from agent A to agent B over the network", async () => {
    const portA = allocPort();
    const portB = allocPort();
    const agentA = "agent-a";
    const agentB = "agent-b";

    const busA = new NetworkMessageBus(portA, { localAgentId: agentA });
    const busB = new NetworkMessageBus(portB, { localAgentId: agentB });
    buses.push(busA, busB);

    await busA.start();
    await busB.start();
    await delay(100);

    const received: string[] = [];
    busB.subscribe(agentB, (msg) => {
      received.push(msg.id);
    });

    await busA.connectTo("127.0.0.1", portB, agentB);
    await delay(100);

    const msg = busA.sendMessage(agentA, agentB, "handshake", {
      hello: "world",
    });

    // Wait for delivery over the wire.
    await delay(150);

    expect(received).toContain(msg.id);
  });

  it("accumulates received messages in getMessages()", async () => {
    const portA = allocPort();
    const portB = allocPort();
    const agentA = "agent-a2";
    const agentB = "agent-b2";

    const busA = new NetworkMessageBus(portA, { localAgentId: agentA });
    const busB = new NetworkMessageBus(portB, { localAgentId: agentB });
    buses.push(busA, busB);

    await busA.start();
    await busB.start();
    await delay(100);

    busB.subscribe(agentB, () => {});

    await busA.connectTo("127.0.0.1", portB, agentB);
    await delay(100);

    busA.sendMessage(agentA, agentB, "reputation-query", {});
    busA.sendMessage(agentA, agentB, "content-draft", { content: "hi" });
    await delay(150);

    // busB should have stored both inbound messages
    const bMessages = busB.getMessages();
    expect(bMessages.length).toBeGreaterThanOrEqual(2);
    expect(bMessages.some((m) => m.type === "reputation-query")).toBe(true);
    expect(bMessages.some((m) => m.type === "content-draft")).toBe(true);
  });

  it("delivers messages to local subscribers without a socket hop", async () => {
    const port = allocPort();
    const agentX = "agent-x";

    const bus = new NetworkMessageBus(port, { localAgentId: agentX });
    buses.push(bus);

    await bus.start();
    await delay(100);

    const received: string[] = [];
    bus.subscribe(agentX, (msg) => {
      received.push(msg.type);
    });

    bus.sendMessage("someone", agentX, "handshake", {});
    expect(received).toContain("handshake");
    expect(bus.getMessages().length).toBe(1);
  });

  it("supports stop() without error when never started", async () => {
    const bus = new NetworkMessageBus(allocPort());
    buses.push(bus);
    await expect(bus.stop()).resolves.toBeUndefined();
  });
});
