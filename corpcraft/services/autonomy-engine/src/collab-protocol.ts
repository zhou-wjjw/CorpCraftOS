// ──────────────────────────────────────────────
// CollabProtocol — Zone-based collaboration management
//
// Manages the lifecycle of collaboration sessions within
// zones, including:
//   - Join request / approval flow
//   - Lead election
//   - Work plan negotiation & sync
//   - Member lifecycle (join, leave, role changes)
//
// Integration:
//   - Uses AgentComms for structured inter-agent messaging
//   - Publishes ZONE_JOIN_REQUEST / ZONE_JOIN_RESOLVED /
//     ZONE_COLLAB_SYNC events on the event bus
//   - User approval gate with timeout fallback
// ──────────────────────────────────────────────

import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";
import type {
  SwarmEvent,
  AgentEntity,
  ZoneCollabSession,
  ZoneJoinRequest,
  ZoneJoinResolution,
  CollabMember,
  SharedWorkPlan,
  JoinTrigger,
  CollabRole,
} from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { AgentComms } from "./agent-comms.js";

// ── Constants ──

const DEFAULT_JOIN_TIMEOUT_MS = 30_000;
const MAX_SESSIONS = 100;

export class CollabProtocol {
  private sessions = new Map<string, ZoneCollabSession>();
  /** Zone ID → session ID lookup */
  private zoneSessionIndex = new Map<string, string>();
  /** Pending join requests awaiting resolution */
  private pendingJoins = new Map<string, ZoneJoinRequest>();
  /** Timeout timers for join requests */
  private joinTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private unsubscribes: Unsubscribe[] = [];
  /** Agent registry for looking up capabilities */
  private agentLookup: (id: string) => AgentEntity | undefined = () =>
    undefined;

  constructor(
    private readonly bus: IEventBus,
    private readonly comms: AgentComms,
  ) {}

  // ── Lifecycle ──

  init(agentLookup: (id: string) => AgentEntity | undefined): void {
    this.agentLookup = agentLookup;

    this.unsubscribes.push(
      this.bus.subscribe(
        ["ZONE_JOIN_RESOLVED", "TASK_CLOSED", "TASK_FAILED"],
        this.handleEvent.bind(this),
      ),
    );
  }

  shutdown(): void {
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
    for (const timer of this.joinTimers.values()) clearTimeout(timer);
    this.joinTimers.clear();
    this.pendingJoins.clear();
  }

  // ── Public API ──

  getSession(sessionId: string): ZoneCollabSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByZone(zoneId: string): ZoneCollabSession | undefined {
    const sessionId = this.zoneSessionIndex.get(zoneId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getAllSessions(): ZoneCollabSession[] {
    return [...this.sessions.values()];
  }

  getPendingJoins(): ZoneJoinRequest[] {
    return [...this.pendingJoins.values()];
  }

  /**
   * Initiate the join flow for an agent entering a zone.
   *
   * - USER trigger: direct join, skip approval
   * - AGENT/SUMMON trigger: require approval (user → zone lead → auto)
   */
  async requestJoin(
    agentId: string,
    zoneId: string,
    trigger: JoinTrigger,
  ): Promise<string> {
    const agent = this.agentLookup(agentId);
    const agentName = agent?.name ?? agentId;

    if (trigger === "USER") {
      // User-initiated: direct join, no approval needed
      const session = this.getOrCreateSession(zoneId);
      this.addMember(session, agentId, agentName, agent?.role_tags ?? [], "ACTIVE");
      await this.announceCapabilities(session, agentId);
      await this.syncSession(session);
      console.log(
        `[CollabProtocol] ${agentName} force-joined zone ${zoneId} (user-initiated)`,
      );
      return session.session_id;
    }

    // Agent/Summon-initiated: need approval
    const request: ZoneJoinRequest = {
      request_id: crypto.randomUUID(),
      agent_id: agentId,
      agent_name: agentName,
      zone_id: zoneId,
      trigger,
      timeout_ms: DEFAULT_JOIN_TIMEOUT_MS,
      created_at: Date.now(),
    };

    this.pendingJoins.set(request.request_id, request);

    // Publish join request event for frontend
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "ZONE_JOIN_REQUEST",
        intent: `${agentName} requests to join zone ${zoneId}`,
        payload: { join_request: request },
        status: "OPEN",
      }),
    );

    // Set timeout for fallback
    const timer = setTimeout(async () => {
      this.joinTimers.delete(request.request_id);
      if (!this.pendingJoins.has(request.request_id)) return;

      // Timeout fallback: ask zone lead or auto-approve
      const session = this.getSessionByZone(zoneId);
      const lead = session?.members.find(
        (m) => m.role === "LEAD" && m.join_status === "ACTIVE",
      );

      if (lead) {
        // Ask lead to decide via agent comms
        await this.comms.sendMessage(
          "system",
          lead.agent_id,
          JSON.stringify({
            type: "ZONE_JOIN_REQUEST",
            agent_id: agentId,
            agent_name: agentName,
            zone_id: zoneId,
          }),
          { provenance: "inter_session" },
        );
        // For now, auto-approve after lead is notified
        await this.resolveJoin({
          request_id: request.request_id,
          approved: true,
          decided_by: "AGENT",
          reason: `Zone lead ${lead.agent_name} notified, auto-approved`,
        });
      } else {
        // No agents in zone — auto-approve
        await this.resolveJoin({
          request_id: request.request_id,
          approved: true,
          decided_by: "SYSTEM",
          reason: "No zone lead, auto-approved on timeout",
        });
      }
    }, request.timeout_ms);

    this.joinTimers.set(request.request_id, timer);

    console.log(
      `[CollabProtocol] Join request ${request.request_id} for ${agentName} → zone ${zoneId}`,
    );
    return request.request_id;
  }

  /**
   * Resolve a pending join request.
   */
  async resolveJoin(resolution: ZoneJoinResolution): Promise<void> {
    const request = this.pendingJoins.get(resolution.request_id);
    if (!request) return;

    // Clear timeout
    const timer = this.joinTimers.get(resolution.request_id);
    if (timer) {
      clearTimeout(timer);
      this.joinTimers.delete(resolution.request_id);
    }
    this.pendingJoins.delete(resolution.request_id);

    // Publish resolution event
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "ZONE_JOIN_RESOLVED",
        intent: `Join ${resolution.approved ? "approved" : "rejected"} for ${request.agent_name} → zone ${request.zone_id}`,
        payload: {
          join_resolution: resolution,
          original_request: request,
        },
        status: "CLOSED",
      }),
    );

    if (resolution.approved) {
      const agent = this.agentLookup(request.agent_id);
      const session = this.getOrCreateSession(request.zone_id);
      this.addMember(
        session,
        request.agent_id,
        request.agent_name,
        agent?.role_tags ?? [],
        "ACTIVE",
      );
      await this.announceCapabilities(session, request.agent_id);
      await this.syncSession(session);
    }

    console.log(
      `[CollabProtocol] Join ${resolution.approved ? "approved" : "rejected"}: ${request.agent_name} → zone ${request.zone_id} (by ${resolution.decided_by})`,
    );
  }

  /**
   * Remove an agent from a zone's collaboration session.
   */
  async removeMember(agentId: string, zoneId: string): Promise<void> {
    const session = this.getSessionByZone(zoneId);
    if (!session) return;

    const idx = session.members.findIndex((m) => m.agent_id === agentId);
    if (idx === -1) return;

    const wasLead = session.members[idx].role === "LEAD";
    session.members.splice(idx, 1);
    session.updated_at = Date.now();

    if (session.members.length === 0) {
      // Session empty, clean up
      this.sessions.delete(session.session_id);
      this.zoneSessionIndex.delete(zoneId);
    } else if (wasLead) {
      // Re-elect lead
      this.electLead(session);
      await this.syncSession(session);
    }
  }

  /**
   * Update the shared work plan for a zone's collaboration session.
   */
  async updateWorkPlan(
    zoneId: string,
    plan: SharedWorkPlan,
  ): Promise<void> {
    const session = this.getSessionByZone(zoneId);
    if (!session) return;

    session.work_plan = plan;
    session.updated_at = Date.now();
    await this.syncSession(session);
  }

  // ── Internal ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
    switch (event.topic) {
      case "ZONE_JOIN_RESOLVED": {
        // External resolution (e.g., from gateway/user)
        const resolution = event.payload
          ?.join_resolution as ZoneJoinResolution | undefined;
        if (resolution && this.pendingJoins.has(resolution.request_id)) {
          await this.resolveJoin(resolution);
        }
        break;
      }

      case "TASK_CLOSED":
      case "TASK_FAILED": {
        // Update work plan task status when tasks complete
        const eventId = event.event_id;
        for (const session of this.sessions.values()) {
          const task = session.work_plan.tasks.find(
            (t) => t.task_id === eventId,
          );
          if (task) {
            task.status = event.topic === "TASK_CLOSED" ? "DONE" : "BLOCKED";
            session.updated_at = Date.now();
            await this.syncSession(session);
          }
        }
        break;
      }
    }
  }

  private getOrCreateSession(zoneId: string): ZoneCollabSession {
    const existingId = this.zoneSessionIndex.get(zoneId);
    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing) return existing;
    }

    // Enforce session limit
    if (this.sessions.size >= MAX_SESSIONS) {
      // Remove oldest session with fewest members
      let oldest: ZoneCollabSession | null = null;
      for (const s of this.sessions.values()) {
        if (!oldest || s.members.length < oldest.members.length) {
          oldest = s;
        }
      }
      if (oldest) {
        this.sessions.delete(oldest.session_id);
        this.zoneSessionIndex.delete(oldest.zone_id);
      }
    }

    const now = Date.now();
    const session: ZoneCollabSession = {
      session_id: `collab-${zoneId}-${now}`,
      zone_id: zoneId,
      members: [],
      work_plan: {
        tasks: [],
        assignments: {},
        dependencies: [],
        estimated_completion: 0,
      },
      created_at: now,
      updated_at: now,
    };

    this.sessions.set(session.session_id, session);
    this.zoneSessionIndex.set(zoneId, session.session_id);

    return session;
  }

  private addMember(
    session: ZoneCollabSession,
    agentId: string,
    agentName: string,
    capabilities: string[],
    joinStatus: "ACTIVE" | "PENDING_USER" | "PENDING_AGENTS",
  ): void {
    // Don't add duplicates
    if (session.members.some((m) => m.agent_id === agentId)) return;

    const role: CollabRole = session.members.length === 0 ? "LEAD" : "CONTRIBUTOR";
    const member: CollabMember = {
      agent_id: agentId,
      agent_name: agentName,
      role,
      join_status: joinStatus,
      capabilities,
      joined_at: Date.now(),
    };

    session.members.push(member);
    session.updated_at = Date.now();
  }

  /**
   * Elect a lead from active members (highest success rate).
   */
  private electLead(session: ZoneCollabSession): void {
    const activeMembers = session.members.filter(
      (m) => m.join_status === "ACTIVE",
    );
    if (activeMembers.length === 0) return;

    // Reset all roles to CONTRIBUTOR
    for (const m of activeMembers) m.role = "CONTRIBUTOR";

    // Find agent with best metrics
    let best = activeMembers[0];
    for (const m of activeMembers) {
      const agent = this.agentLookup(m.agent_id);
      const bestAgent = this.agentLookup(best.agent_id);
      if (
        agent &&
        bestAgent &&
        agent.metrics.success_rate_7d > bestAgent.metrics.success_rate_7d
      ) {
        best = m;
      }
    }

    best.role = "LEAD";
    session.updated_at = Date.now();
  }

  /**
   * Broadcast capabilities of a newly joined agent to other zone members.
   */
  private async announceCapabilities(
    session: ZoneCollabSession,
    agentId: string,
  ): Promise<void> {
    const agent = this.agentLookup(agentId);
    if (!agent) return;

    const message = JSON.stringify({
      type: "CAPABILITY_ANNOUNCE",
      zone_id: session.zone_id,
      from_agent_id: agentId,
      payload: {
        agent_name: agent.name,
        role_tags: agent.role_tags,
        equipped_skills: agent.equipped_skills,
        status: agent.status,
      },
      timestamp: Date.now(),
    });

    // Send to all other active members
    for (const member of session.members) {
      if (member.agent_id !== agentId && member.join_status === "ACTIVE") {
        await this.comms.sendMessage(agentId, member.agent_id, message, {
          provenance: "inter_session",
        });
      }
    }
  }

  /**
   * Publish the current session state to the event bus for frontend sync.
   */
  private async syncSession(session: ZoneCollabSession): Promise<void> {
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "ZONE_COLLAB_SYNC",
        intent: `Collab sync for zone ${session.zone_id}`,
        payload: { collab_session: session },
        status: "CLOSED",
      }),
    );
  }
}
