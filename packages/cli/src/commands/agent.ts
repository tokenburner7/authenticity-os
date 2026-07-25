/**
 * @auth/cli — agent start command
 *
 * Starts a networked agent node that:
 * 1. Loads or creates an identity from the local store
 * 2. Starts a WebSocket server
 * 3. Registers with the discovery registry
 * 4. Discovers peers and auto-connects (the viral loop)
 * 5. Listens for incoming interactions
 */

import { Command } from "commander";
import { createIdentity, type Identity } from "@auth/protocol";
import { createAgentForIdentity, NetworkMessageBus, RegistryClient } from "@auth/agent";
import { loadStore, saveStore, type StoreData } from "../store.js";

export const agentCommand = new Command("agent")
  .description("Run a networked agent node");

agentCommand
  .command("start")
  .description("Start a networked agent that discovers and connects to peers")
  .requiredOption("--name <name>", "Agent display name")
  .option("--port <port>", "WebSocket port to listen on", "3001")
  .option("--registry <url>", "Registry server URL", "http://localhost:4000")
  .option("--store <path>", "Store file path", "./.auth/store.json")
  .option("--bio <text>", "Agent bio", "")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);

    // 1. Load or create identity
    const store = loadStore(opts.store);
    let identity: Identity;

    if (store.identity) {
      identity = store.identity as Identity;
      console.log(`Loaded identity: ${identity.handle} (${identity.id.slice(0, 16)}...)`);
    } else {
      identity = createIdentity(opts.name, "peer");
      store.identity = identity;
      saveStore(opts.store, store);
      console.log(`Created new identity: ${identity.handle} (${identity.id.slice(0, 16)}...)`);
    }

    // 2. Create agent
    const agent = createAgentForIdentity(
      {
        name: opts.name,
        bio: opts.bio,
        capabilities: ["draft-content", "socialise"],
      },
      identity
    );

    // 3. Start network bus
    const bus = new NetworkMessageBus(port, { localAgentId: agent.profile.id });
    await bus.start();
    console.log(`Agent listening on ws://localhost:${port}`);

    // Subscribe to incoming messages
    bus.subscribe(agent.profile.id, (msg) => {
      console.log(`[${new Date().toISOString()}] Received ${msg.type} from ${msg.from.slice(0, 16)}...`);
    });

    // 4. Register with registry
    const registry = new RegistryClient(opts.registry);

    const healthy = await registry.health();
    if (!healthy) {
      console.error(`Registry not reachable at ${opts.registry}`);
      console.error("Start the registry server first: cd apps/registry-server && pnpm dev");
      process.exit(1);
    }

    await registry.register(agent.profile, { host: "localhost", port });
    console.log(`Registered with registry at ${opts.registry}`);

    // 5. Discover and connect
    const connected = await agent.discoverAndConnect(registry, bus);
    if (connected.length > 0) {
      console.log(`Discovered and connected to ${connected.length} agent(s):`);
      for (const peer of connected) {
        console.log(`  → ${peer.name} (${peer.id.slice(0, 16)}...)`);
      }
    } else {
      console.log("No new peers discovered. Waiting for connections...");
    }

    console.log("\nAgent is running. Press Ctrl+C to stop.");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await registry.unregister(agent.profile.id);
      await bus.stop();
      process.exit(0);
    });
  });