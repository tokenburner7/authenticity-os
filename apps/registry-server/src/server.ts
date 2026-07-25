/**
 * @auth/registry-server — Agent discovery registry
 *
 * A simple HTTP server where agents register their WebSocket endpoint
 * and query for other agents to connect with.
 *
 * Endpoints:
 *   POST /register   — { agentId, name, endpoint, capabilities } → registers agent
 *   GET  /agents      — list all registered agents
 *   GET  /agents/:id  — get specific agent
 *   POST /unregister  — { agentId } → removes agent
 *   GET  /health      — health check
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface AgentRegistration {
  agentId: string;
  name: string;
  endpoint: { host: string; port: number };
  capabilities: string[];
  registeredAt: string;
}

export class RegistryServer {
  private agents = new Map<string, AgentRegistration>();
  private server: ReturnType<typeof createServer> | null = null;

  register(reg: Omit<AgentRegistration, "registeredAt">): AgentRegistration {
    const entry: AgentRegistration = {
      ...reg,
      registeredAt: new Date().toISOString(),
    };
    this.agents.set(reg.agentId, entry);
    return entry;
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  list(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  lookup(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  start(port: number = 4000): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(port, () => {
        console.log(`Registry server listening on port ${port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader("Content-Type", "application/json");

    // CORS headers for browser-based agents
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost`);
    const path = url.pathname;

    try {
      // Health check
      if (path === "/health" && req.method === "GET") {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", agents: this.agents.size }));
        return;
      }

      // Register
      if (path === "/register" && req.method === "POST") {
        const body = await readBody(req);
        const data = JSON.parse(body) as Omit<AgentRegistration, "registeredAt">;
        const entry = this.register(data);
        res.writeHead(201);
        res.end(JSON.stringify(entry));
        return;
      }

      // Unregister
      if (path === "/unregister" && req.method === "POST") {
        const body = await readBody(req);
        const { agentId } = JSON.parse(body) as { agentId: string };
        const removed = this.unregister(agentId);
        res.writeHead(removed ? 200 : 404);
        res.end(JSON.stringify({ removed }));
        return;
      }

      // List all agents
      if (path === "/agents" && req.method === "GET") {
        res.writeHead(200);
        res.end(JSON.stringify(this.list()));
        return;
      }

      // Lookup specific agent
      const agentMatch = path.match(/^\/agents\/(.+)$/);
      if (agentMatch && req.method === "GET") {
        const agentId = agentMatch[1];
        const entry = this.lookup(agentId);
        if (entry) {
          res.writeHead(200);
          res.end(JSON.stringify(entry));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Agent not found" }));
        }
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
