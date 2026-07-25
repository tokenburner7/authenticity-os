/**
 * @auth/agent — Registry client
 *
 * Client for the agent discovery registry. Agents use this to register
 * themselves and discover other agents to connect with.
 *
 * The registry is a simple HTTP server (see apps/registry-server).
 */

import type { AgentProfile } from "./types.js";

export interface AgentRegistration {
  agentId: string;
  name: string;
  endpoint: { host: string; port: number };
  capabilities: string[];
  registeredAt: string;
}

export class RegistryClient {
  constructor(private registryUrl: string = "http://localhost:4000") {}

  async register(
    profile: AgentProfile,
    endpoint: { host: string; port: number }
  ): Promise<AgentRegistration> {
    const res = await fetch(`${this.registryUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: profile.id,
        name: profile.name,
        endpoint,
        capabilities: profile.capabilities,
      }),
    });

    if (!res.ok) {
      throw new Error(`Registry register failed: ${res.status} ${await res.text()}`);
    }

    return res.json() as Promise<AgentRegistration>;
  }

  async discover(filter?: { capability?: string }): Promise<AgentRegistration[]> {
    const res = await fetch(`${this.registryUrl}/agents`);

    if (!res.ok) {
      throw new Error(`Registry discover failed: ${res.status}`);
    }

    const agents = (await res.json()) as AgentRegistration[];

    if (filter?.capability) {
      return agents.filter((a) => a.capabilities.includes(filter.capability!));
    }

    return agents;
  }

  async lookup(agentId: string): Promise<AgentRegistration | undefined> {
    const res = await fetch(`${this.registryUrl}/agents/${agentId}`);

    if (res.status === 404) return undefined;
    if (!res.ok) {
      throw new Error(`Registry lookup failed: ${res.status}`);
    }

    return res.json() as Promise<AgentRegistration>;
  }

  async unregister(agentId: string): Promise<boolean> {
    const res = await fetch(`${this.registryUrl}/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });

    if (!res.ok) return false;
    const data = (await res.json()) as { removed: boolean };
    return data.removed;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.registryUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
