/**
 * Registry server + client integration tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegistryServer } from "../../../apps/registry-server/src/server.js";
import { RegistryClient, createAgent } from "../src/index.js";

const REGISTRY_PORT = 4199;

let server: RegistryServer;
let client: RegistryClient;

beforeAll(async () => {
  server = new RegistryServer();
  await server.start(REGISTRY_PORT);
  client = new RegistryClient(`http://localhost:${REGISTRY_PORT}`);
});

afterAll(async () => {
  await server.stop();
});

describe("registry", () => {
  it("health check returns ok", async () => {
    const ok = await client.health();
    expect(ok).toBe(true);
  });

  it("registers an agent and discovers it", async () => {
    const agent = createAgent({
      name: "Test Agent",
      bio: "",
      capabilities: ["draft-content"],
    });

    await client.register(agent.profile, { host: "localhost", port: 9001 });

    const agents = await client.discover();
    expect(agents.length).toBeGreaterThanOrEqual(1);

    const found = agents.find((a) => a.agentId === agent.profile.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Test Agent");
    expect(found!.endpoint.port).toBe(9001);
    expect(found!.capabilities).toContain("draft-content");
  });

  it("looks up a specific agent by ID", async () => {
    const agent = createAgent({
      name: "Lookup Target",
      bio: "",
      capabilities: ["schedule"],
    });

    await client.register(agent.profile, { host: "localhost", port: 9002 });

    const found = await client.lookup(agent.profile.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Lookup Target");
  });

  it("returns undefined for unknown agent", async () => {
    const found = await client.lookup("nonexistent-agent-id");
    expect(found).toBeUndefined();
  });

  it("discovers agents filtered by capability", async () => {
    const a1 = createAgent({ name: "A1", bio: "", capabilities: ["draft-content"] });
    const a2 = createAgent({ name: "A2", bio: "", capabilities: ["negotiate"] });

    await client.register(a1.profile, { host: "localhost", port: 9003 });
    await client.register(a2.profile, { host: "localhost", port: 9004 });

    const drafters = await client.discover({ capability: "draft-content" });
    const negotiators = await client.discover({ capability: "negotiate" });

    expect(drafters.some((a) => a.agentId === a1.profile.id)).toBe(true);
    expect(negotiators.some((a) => a.agentId === a2.profile.id)).toBe(true);
    expect(negotiators.some((a) => a.agentId === a1.profile.id)).toBe(false);
  });

  it("unregisters an agent", async () => {
    const agent = createAgent({
      name: "To Remove",
      bio: "",
      capabilities: [],
    });

    await client.register(agent.profile, { host: "localhost", port: 9005 });
    const removed = await client.unregister(agent.profile.id);
    expect(removed).toBe(true);

    const found = await client.lookup(agent.profile.id);
    expect(found).toBeUndefined();
  });

  it("returns false when unregistering unknown agent", async () => {
    const removed = await client.unregister("nonexistent");
    expect(removed).toBe(false);
  });
});