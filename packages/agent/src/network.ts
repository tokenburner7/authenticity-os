/**
 * @auth/agent — WebSocket network transport
 *
 * NetworkMessageBus: a networked implementation of the message bus that
 * delivers messages across machines via WebSocket. Each instance runs a
 * WebSocket server and maintains outbound connections to peer agents'
 * servers. Local subscribers are delivered to synchronously; messages
 * addressed to remote agents are forwarded over the appropriate socket.
 *
 * Each message is serialized as JSON for transport. When a message is
 * received over a socket it is parsed, stored, and delivered to any local
 * subscriber registered for its `to` agent ID.
 */

import * as ws from "ws";
import type { AgentMessage } from "./types.js";
import { generateId } from "./utils.js";

// `ws` uses `export = WebSocket` (CommonJS). Under nodenext with
// esModuleInterop, `import * as ws from "ws"` gives us the namespace:
//   ws.WebSocket       — the client constructor
//   ws.WebSocketServer — the server constructor
//   ws.WebSocket.OPEN  — ready-state constant
type WebSocketClient = InstanceType<typeof ws.WebSocket>;
type WebSocketServer = InstanceType<typeof ws.WebSocketServer>;

/**
 * A frame sent over the wire. Either an envelope containing an AgentMessage,
 * or a handshake announcing the sender's local agent ID.
 */
type WireFrame =
  | { kind: "agent-id"; agentId: string }
  | { kind: "message"; message: AgentMessage };

export interface NetworkMessageBusOptions {
  /** The agent ID hosted locally by this bus. Used for routing + handshake. */
  localAgentId?: string;
}

export class NetworkMessageBus {
  private readonly port: number;
  private readonly localAgentId?: string;
  private server?: WebSocketServer;
  /**
   * Inbound sockets keyed by the remote agent ID (discovered via the
   * agent-id handshake frame), and outbound sockets keyed the same way.
   */
  private readonly inbound = new Map<string, WebSocketClient>();
  private readonly outbound = new Map<string, WebSocketClient>();
  /** Reverse lookup: socket -> remote agent id, for cleanup on close. */
  private readonly socketAgent = new Map<WebSocketClient, string>();

  private readonly messages: AgentMessage[] = [];
  private readonly subscribers = new Map<string, (msg: AgentMessage) => void>();

  constructor(port: number, options: NetworkMessageBusOptions = {}) {
    this.port = port;
    this.localAgentId = options.localAgentId;
  }

  /**
   * Start the WebSocket server on the configured port.
   * Any connecting peer is accepted and wired up to handle incoming frames.
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server: WebSocketServer = new ws.WebSocketServer({
        port: this.port,
      });

      server.on("connection", (socket: WebSocketClient) => {
        this.handleIncomingConnection(socket);
      });

      server.on("error", (err: Error) => {
        reject(err);
      });

      server.on("listening", () => {
        resolve();
      });

      this.server = server;
    });
  }

  /**
   * Open an outbound WebSocket connection to a peer agent's server and
   * register it under the given remote agent ID so messages addressed to
   * that agent can be forwarded.
   */
  async connectTo(
    host: string,
    port: number,
    remoteAgentId: string
  ): Promise<void> {
    const url = `ws://${host}:${port}`;
    return new Promise((resolve, reject) => {
      const socket: WebSocketClient = new ws.WebSocket(url);

      socket.on("open", () => {
        // Announce our local agent id so the peer can route to us.
        if (this.localAgentId) {
          this.sendFrame(socket, {
            kind: "agent-id",
            agentId: this.localAgentId,
          });
        }
        this.outbound.set(remoteAgentId, socket);
        this.socketAgent.set(socket, remoteAgentId);
        resolve();
      });

      socket.on("message", (data: unknown) => {
        this.handleWireFrame(data, socket);
      });

      socket.on("error", (err: Error) => {
        reject(err);
      });

      socket.on("close", () => {
        const agentId = this.socketAgent.get(socket);
        if (agentId) {
          if (this.outbound.get(agentId) === socket) {
            this.outbound.delete(agentId);
          }
          this.socketAgent.delete(socket);
        }
      });
    });
  }

  /**
   * Register a local subscriber for a given agent ID. When a message
   * addressed to that agent is received (locally or over the network),
   * the callback is invoked.
   */
  subscribe(agentId: string, callback: (msg: AgentMessage) => void): void {
    this.subscribers.set(agentId, callback);
  }

  /**
   * Send a message. If the recipient is a local subscriber, deliver locally;
   * otherwise forward it over the outbound WebSocket connection to the peer
   * that hosts that recipient (if any). The message is always stored.
   */
  sendMessage(
    from: string,
    to: string,
    type: AgentMessage["type"],
    payload: unknown
  ): AgentMessage {
    const message: AgentMessage = {
      id: generateId(),
      from,
      to,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    this.deliver(message);
    return message;
  }

  /** Deliver an already-constructed message. Used for both local + inbound. */
  private deliver(message: AgentMessage): void {
    this.messages.push(message);

    const localCallback = this.subscribers.get(message.to);
    if (localCallback) {
      localCallback(message);
      return;
    }

    // Not a local agent — forward over the wire if we have a route.
    const socket = this.outbound.get(message.to);
    if (socket && socket.readyState === ws.WebSocket.OPEN) {
      this.sendFrame(socket, { kind: "message", message });
    }
  }

  /** Return all messages seen by this bus. */
  getMessages(): AgentMessage[] {
    return this.messages;
  }

  /**
   * Shut down the server and all open connections. Safe to call multiple
   * times.
   */
  async stop(): Promise<void> {
    const closeAll = (sockets: Map<string, WebSocketClient>) => {
      for (const socket of sockets.values()) {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
      sockets.clear();
    };
    closeAll(this.outbound);
    closeAll(this.inbound);
    this.socketAgent.clear();

    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }
      this.server.close(() => resolve());
      this.server = undefined;
    });
  }

  // ---- internals -----------------------------------------------------------

  private handleIncomingConnection(socket: WebSocketClient): void {
    socket.on("message", (data: unknown) => {
      this.handleWireFrame(data, socket);
    });

    socket.on("close", () => {
      const agentId = this.socketAgent.get(socket);
      if (agentId && this.inbound.get(agentId) === socket) {
        this.inbound.delete(agentId);
      }
      this.socketAgent.delete(socket);
    });
  }

  private handleWireFrame(data: unknown, socket: WebSocketClient): void {
    let frame: WireFrame;
    try {
      const text =
        typeof data === "string"
          ? data
          : Buffer.isBuffer(data)
            ? data.toString("utf8")
            : Array.isArray(data)
              ? Buffer.concat(data as Buffer[]).toString("utf8")
              : String(data);
      frame = JSON.parse(text) as WireFrame;
    } catch {
      return; // malformed frame, ignore
    }

    if (frame.kind === "agent-id") {
      // Register the inbound socket under the announced remote agent id.
      this.inbound.set(frame.agentId, socket);
      this.socketAgent.set(socket, frame.agentId);
      return;
    }

    if (frame.kind === "message") {
      const message = frame.message;
      // Store + deliver to any local subscriber. If the recipient is not
      // local, attempt to forward over a known outbound connection.
      const localCallback = this.subscribers.get(message.to);
      if (localCallback) {
        this.messages.push(message);
        localCallback(message);
        return;
      }
      const out = this.outbound.get(message.to);
      if (out && out.readyState === ws.WebSocket.OPEN) {
        this.sendFrame(out, { kind: "message", message });
      }
    }
  }

  private sendFrame(socket: WebSocketClient, frame: WireFrame): void {
    socket.send(JSON.stringify(frame));
  }
}
