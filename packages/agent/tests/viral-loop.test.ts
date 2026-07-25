/**
 * Viral loop test: agents discover each other via registry,
 * auto-connect, and exchange handshakes.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { RegistryServer } from "../../../apps/registry-server/src/server.js";
import {
  createAgentForIdentity,
  RegistryClient,
  NetworkMessageBus,
} from "../src/index.js";
import { createIdentity } from "@auth/protocol";

const REGISTRY_PORT = 4299;
const AGENT_PORT_BASE = 9301;

let registry: RegistryServer;
let client: RegistryClient;
const agentIds: string[] = [];

beforeAll(async () => {
  registry = new RegistryServer();
  await registry.start(REGISTRY_PORT);
  client = new RegistryClient(`http://localhost:${REGISTRY_PORT}`);
});

afterEach(async () => {
  // Clean up registry between tests
  for (const id of agentIds) {
    await client.unregister(id);
  }
  agentIds.length = 0;
});

afterAll(async () => {
  await registry.stop();
});

describe("viral loop", () => {
  it("agent discovers and handshakes with a peer via registry", async () => {
    const portA = AGENT_PORT_BASE;
    const portB = AGENT_PORT_BASE + 1;

    // Create two agents with identities
    const aliceId = createIdentity("alice", "peer");
    const bobId = createIdentity("bob", "peer");

    const alice = createAgentForIdentity(
      { name: "Alice Agent", bio: "", capabilities: ["draft-content"] },
      aliceId
    );
    const bob = createAgentForIdentity(
      { name: "Bob Agent", bio: "", capabilities: ["draft-content"] },
      bobId
    );

    // Start network buses
    const busA = new NetworkMessageBus(portA, { localAgentId: alice.profile.id });
    const busB = new NetworkMessageBus(portB, { localAgentId: bob.profile.id });

    await busA.start();
    await busB.start();
    await new Promise((r) => setTimeout(r, 100));

    // Subscribe bob to receive messages
    let bobReceived = false;
    busB.subscribe(bob.profile.id, () => {
      bobReceived = true;
    });

    // Register both agents with the registry
    await client.register(alice.profile, { host: "127.0.0.1", port: portA });
    await client.register(bob.profile, { host: "127.0.0.1", port: portB });
    agentIds.push(alice.profile.id, bob.profile.id);

    // Alice discovers and connects to peers
    const connected = await alice.discoverAndConnect(client, busA);
    await new Promise((r) => setTimeout(r, 200));

    // Alice should have discovered Bob
    expect(connected.length).toBeGreaterThanOrEqual(1);
    expect(alice.getKnownAgents().some((a) => a.id === bob.profile.id)).toBe(true);

    // Bob should have received the handshake
    expect(bobReceived).toBe(true);

    // Cleanup
    await busA.stop();
    await busB.stop();
  }, 10000);

  it("does not reconnect to already-known agents", async () => {
    const portC = AGENT_PORT_BASE + 2;
    const portD = AGENT_PORT_BASE + 3;

    const carolId = createIdentity("carol", "peer");
    const daveId = createIdentity("dave", "peer");

    const carol = createAgentForIdentity(
      { name: "Carol Agent", bio: "", capabilities: [] },
      carolId
    );
    const dave = createAgentForIdentity(
      { name: "Dave Agent", bio: "", capabilities: [] },
      daveId
    );

    const busC = new NetworkMessageBus(portC, { localAgentId: carol.profile.id });
    const busD = new NetworkMessageBus(portD, { localAgentId: dave.profile.id });

    await busC.start();
    await busD.start();
    await new Promise((r) => setTimeout(r, 100));

    // Register both
    await client.register(carol.profile, { host: "127.0.0.1", port: portC });
    await client.register(dave.profile, { host: "127.0.0.1", port: portD });
    agentIds.push(carol.profile.id, dave.profile.id);

    // First discovery
    const first = await carol.discoverAndConnect(client, busC);
    expect(first.length).toBeGreaterThanOrEqual(1);

    // Second discovery — should find no new agents
    const second = await carol.discoverAndConnect(client, busC);
    expect(second).toHaveLength(0);

    // Cleanup
    await busC.stop();
    await busD.stop();
  }, 10000);
});