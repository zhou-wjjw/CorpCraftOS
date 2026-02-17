// ──────────────────────────────────────────────
// AgentComms — Inter-agent communication layer
//
// Inspired by OpenClaw's sessions_* tools:
//   sessions_list  → listSessions()
//   sessions_send  → sendMessage()
//   sessions_spawn → spawnSession()
//   sessions_history → getHistory()
//
// Each agent runs as an independent session. This module provides
// the communication bus that lets agents discover each other,
// exchange messages, and coordinate work.
// ──────────────────────────────────────────────

import type { IEventBus } from "@corpcraft/event-bus";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { CollabMessage, CollabMessageType } from "@corpcraft/contracts";

// ── Session Types ──

export type SessionStatus = "idle" | "working" | "paused" | "archived";

export interface AgentSession {
  sessionId: string;
  agentId: string;
  agentName: string;
  status: SessionStatus;
  currentTask?: string;
  zoneId?: string;
  /** Timestamp of last activity */
  lastActivity: number;
  /** Timestamp of session creation */
  createdAt: number;
  /** Total tokens consumed in this session */
  totalTokens: number;
  /** Message history (bounded) */
  messages: SessionMessage[];
}

export interface SessionMessage {
  messageId: string;
  fromAgent: string;
  toAgent: string;
  content: string;
  timestamp: number;
  /** Distinguish user commands from inter-agent messages */
  provenance: "user" | "inter_session" | "system";
  /** Optional reply-back context */
  replyTo?: string;
}

// ── AgentComms ──

const MAX_MESSAGES_PER_SESSION = 100;
const MAX_SESSIONS = 50;

export class AgentComms {
  private sessions = new Map<string, AgentSession>();

  constructor(private readonly bus: IEventBus) {}

  // ── sessions_list equivalent ──

  /**
   * List active agent sessions, optionally filtered.
   */
  listSessions(opts?: {
    status?: SessionStatus;
    zoneId?: string;
    activeMinutes?: number;
  }): AgentSession[] {
    let results = [...this.sessions.values()];

    if (opts?.status) {
      results = results.filter((s) => s.status === opts.status);
    }
    if (opts?.zoneId) {
      results = results.filter((s) => s.zoneId === opts.zoneId);
    }
    if (opts?.activeMinutes) {
      const cutoff = Date.now() - opts.activeMinutes * 60_000;
      results = results.filter((s) => s.lastActivity >= cutoff);
    }

    return results.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  // ── sessions_send equivalent ──

  /**
   * Send a message from one agent to another.
   * Returns the message ID. The target agent will receive
   * a TASK_PROGRESS event with the message.
   */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    content: string,
    opts?: {
      replyTo?: string;
      provenance?: "user" | "inter_session";
    },
  ): Promise<string> {
    const messageId = crypto.randomUUID();
    const now = Date.now();

    const message: SessionMessage = {
      messageId,
      fromAgent: fromAgentId,
      toAgent: toAgentId,
      content,
      timestamp: now,
      provenance: opts?.provenance ?? "inter_session",
      replyTo: opts?.replyTo,
    };

    // Store in sender's session
    const senderSession = this.sessions.get(fromAgentId);
    if (senderSession) {
      senderSession.messages.push(message);
      if (senderSession.messages.length > MAX_MESSAGES_PER_SESSION) {
        senderSession.messages.shift();
      }
      senderSession.lastActivity = now;
    }

    // Store in receiver's session
    const receiverSession = this.sessions.get(toAgentId);
    if (receiverSession) {
      receiverSession.messages.push(message);
      if (receiverSession.messages.length > MAX_MESSAGES_PER_SESSION) {
        receiverSession.messages.shift();
      }
      receiverSession.lastActivity = now;
    }

    // Publish as an event so the system can route it
    await this.bus.publish(
      createSwarmEvent({
        event_id: messageId,
        topic: "INTEL_READY",
        intent: `[Inter-agent] ${content.slice(0, 100)}`,
        payload: {
          source: "agent_comms",
          from_agent_id: fromAgentId,
          to_agent_id: toAgentId,
          message_content: content,
          provenance: message.provenance,
          reply_to: opts?.replyTo,
        },
        status: "CLOSED",
      }),
    );

    console.log(
      `[AgentComms] ${fromAgentId} → ${toAgentId}: "${content.slice(0, 60)}"`,
    );

    return messageId;
  }

  // ── sessions_spawn equivalent ──

  /**
   * Spawn a new agent session. Returns the session ID.
   * The spawned session is isolated and can be archived after completion.
   */
  spawnSession(
    agentId: string,
    agentName: string,
    opts?: {
      zoneId?: string;
      task?: string;
    },
  ): string {
    const sessionId = `session-${agentId}-${Date.now()}`;
    const now = Date.now();

    // Enforce session limit
    if (this.sessions.size >= MAX_SESSIONS) {
      // Archive oldest idle session
      let oldest: AgentSession | null = null;
      for (const s of this.sessions.values()) {
        if (s.status === "idle" && (!oldest || s.lastActivity < oldest.lastActivity)) {
          oldest = s;
        }
      }
      if (oldest) {
        this.archiveSession(oldest.agentId);
      }
    }

    const session: AgentSession = {
      sessionId,
      agentId,
      agentName,
      status: opts?.task ? "working" : "idle",
      currentTask: opts?.task,
      zoneId: opts?.zoneId,
      lastActivity: now,
      createdAt: now,
      totalTokens: 0,
      messages: [],
    };

    this.sessions.set(agentId, session);

    console.log(
      `[AgentComms] Spawned session "${sessionId}" for agent ${agentName} (${agentId})`,
    );

    return sessionId;
  }

  // ── sessions_history equivalent ──

  /**
   * Fetch message history for a session.
   */
  getHistory(
    agentId: string,
    opts?: {
      limit?: number;
      includeSystem?: boolean;
    },
  ): SessionMessage[] {
    const session = this.sessions.get(agentId);
    if (!session) return [];

    let messages = [...session.messages];

    if (!opts?.includeSystem) {
      messages = messages.filter((m) => m.provenance !== "system");
    }

    const limit = opts?.limit ?? 50;
    return messages.slice(-limit);
  }

  // ── Session Lifecycle ──

  getSession(agentId: string): AgentSession | undefined {
    return this.sessions.get(agentId);
  }

  updateSessionStatus(agentId: string, status: SessionStatus, task?: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.status = status;
      session.currentTask = task;
      session.lastActivity = Date.now();
    }
  }

  updateTokenUsage(agentId: string, tokens: number): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.totalTokens += tokens;
      session.lastActivity = Date.now();
    }
  }

  archiveSession(agentId: string): void {
    const session = this.sessions.get(agentId);
    if (session) {
      session.status = "archived";
      console.log(
        `[AgentComms] Archived session for agent ${session.agentName} (${agentId})`,
      );
    }
  }

  /** Remove archived sessions older than the given age in minutes */
  cleanupArchived(maxAgeMinutes: number): void {
    const cutoff = Date.now() - maxAgeMinutes * 60_000;
    for (const [id, session] of this.sessions) {
      if (session.status === "archived" && session.lastActivity < cutoff) {
        this.sessions.delete(id);
      }
    }
  }

  // ── Zone-Scoped Collaboration Messaging ──

  /**
   * Send a structured collaboration message to all agents in a zone.
   * Returns the number of agents the message was sent to.
   */
  async broadcastToZone(
    fromAgentId: string,
    zoneId: string,
    collabMsg: CollabMessage,
  ): Promise<number> {
    const zoneSessions = this.listSessions({ zoneId });
    const content = JSON.stringify(collabMsg);
    let count = 0;

    for (const session of zoneSessions) {
      if (session.agentId === fromAgentId) continue;
      if (session.status === "archived") continue;
      await this.sendMessage(fromAgentId, session.agentId, content, {
        provenance: "inter_session",
      });
      count++;
    }

    console.log(
      `[AgentComms] Zone broadcast from ${fromAgentId} → zone ${zoneId}: ${collabMsg.type} (${count} recipients)`,
    );
    return count;
  }

  /**
   * Send a structured collaboration message to a single agent.
   */
  async sendCollabMessage(
    fromAgentId: string,
    toAgentId: string,
    type: CollabMessageType,
    zoneId: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const collabMsg: CollabMessage = {
      type,
      zone_id: zoneId,
      from_agent_id: fromAgentId,
      payload,
      timestamp: Date.now(),
    };

    return this.sendMessage(fromAgentId, toAgentId, JSON.stringify(collabMsg), {
      provenance: "inter_session",
    });
  }

  /**
   * Get all collaboration messages for a zone (from all sessions in that zone).
   */
  getZoneCollabHistory(
    zoneId: string,
    opts?: { limit?: number; type?: CollabMessageType },
  ): CollabMessage[] {
    const zoneSessions = this.listSessions({ zoneId });
    const allMessages: CollabMessage[] = [];

    for (const session of zoneSessions) {
      for (const msg of session.messages) {
        try {
          const parsed = JSON.parse(msg.content) as CollabMessage;
          if (parsed.type && parsed.zone_id === zoneId) {
            if (!opts?.type || parsed.type === opts.type) {
              allMessages.push(parsed);
            }
          }
        } catch {
          // Not a structured collab message, skip
        }
      }
    }

    allMessages.sort((a, b) => a.timestamp - b.timestamp);

    const limit = opts?.limit ?? 100;
    return allMessages.slice(-limit);
  }
}
