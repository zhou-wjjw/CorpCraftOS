// ──────────────────────────────────────────────
// Zustand Store — Single source of truth for swarm state
// Includes demo agents for offline mode
// ──────────────────────────────────────────────

import { create } from "zustand";
import type {
  AgentEntity,
  AutonomyLevel,
  SwarmEvent,
  HudState,
  ServerMessage,
  SwarmMetrics,
  ExecutionModeValue,
  CostDelta,
  SummonRequest,
  SummonResolution,
  ZoneCollabSession,
  ZoneJoinRequest,
  AgentWorkState,
  StatusReport,
} from "@corpcraft/contracts";
import { createDefaultHud } from "@corpcraft/contracts";
import {
  ZONES,
  ZONE_FUNCTION_GROUPS,
  ZONE_SIZE,
  ZONE_GAP,
  ZONE_MAP,
  type ZoneDef,
  type ZoneFunctionGroup,
} from "@/lib/zone-config";

// ── Seed agents from contracts (shared with gateway) ──

import { getSeedAgents } from "@corpcraft/contracts";

const DEMO_AGENTS: AgentEntity[] = getSeedAgents();

// ── State Shape ──

/** Team member status for Claude Agent Teams visualization */
export interface TeamMemberStatus {
  name: string;
  status: "idle" | "working" | "done" | "error";
  currentTask?: string;
}

/** Team status for active Agent Teams */
export interface TeamStatus {
  teamName: string;
  members: TeamMemberStatus[];
  timestamp: number;
}

/** Task progress detail from Claude execution */
export interface TaskProgressDetail {
  eventId: string;
  agentId: string;
  kind: string;     // "thinking" | "tool_use" | "text" | "result" | "error" | "team_status"
  content: string;
  toolName?: string;
  timestamp: number;
}

/** Completed task record — persisted beyond the 100-event rolling window */
export interface CompletedTaskRecord {
  task: SwarmEvent;              // The root TASK_POSTED event
  artifacts: SwarmEvent[];       // ARTIFACT_READY events
  evidence: SwarmEvent[];        // EVIDENCE_READY events
  subTasks: SwarmEvent[];        // Child TASK_POSTED events
  closedEvent: SwarmEvent | null; // TASK_CLOSED or TASK_FAILED event
  costDelta: CostDelta | null;   // Aggregated cost
  completedAt: number;           // Timestamp of completion
}

interface SwarmState {
  agents: AgentEntity[];
  events: SwarmEvent[];
  hud: HudState;
  selectedAgentIds: string[];
  wsConnected: boolean;
  metrics: SwarmMetrics | null;
  /** True if we've received real data from gateway */
  hasRealData: boolean;
  /** Current execution mode from gateway */
  executionMode: ExecutionModeValue;
  /** Selected task event ID for result viewer panel */
  selectedTaskEventId: string | null;
  /** UI modal states */
  recruitModalOpen: boolean;
  settingsModalOpen: boolean;
  settingsAgentId: string | null;
  /** Claude Agent Teams status */
  teamStatuses: TeamStatus[];
  /** Claude execution progress details (recent thinking/tool_use) */
  progressDetails: TaskProgressDetail[];
  /** Model library modal */
  modelLibraryOpen: boolean;
  /** Skill equip panel */
  skillPanelAgentId: string | null;
  /** Task history panel */
  taskHistoryOpen: boolean;
  /** Completed tasks — persisted map keyed by root task event_id */
  completedTaskMap: Map<string, CompletedTaskRecord>;
  /** Zone activation — IDs of zones that are currently active (lit up).
   *  Inactive zones are dimmed on the map but still visible.
   *  No trial/usage limits — first agent entry activates the zone. */
  activeZoneIds: string[];
  /** Runtime zone registry — starts from ZONES, grows via expansion */
  zoneRegistry: ZoneDef[];
  /** Runtime copy of function groups — mutated when zones are added */
  groupRegistry: ZoneFunctionGroup[];
  /** Occupied cell set for fast adjacency lookup — "col,row" keys */
  occupiedCells: Set<string>;
  /** Global visibility toggle for task panels / speech bubbles */
  taskPanelsVisible: boolean;
  /** Group editor panel — which group is currently being edited */
  groupEditorGroupId: string | null;

  // ── Agent Summoning & Collaboration State ──

  /** Pending summon requests awaiting user decision */
  summonRequests: SummonRequest[];
  /** Active zone collaboration sessions, keyed by session_id */
  collabSessions: Map<string, ZoneCollabSession>;
  /** Per-agent work states (priority queue, blockers, etc.) */
  agentWorkStates: Map<string, AgentWorkState>;
  /** Pending zone join requests */
  pendingJoinRequests: ZoneJoinRequest[];
  /** Latest status reports per agent */
  agentStatusReports: Map<string, StatusReport>;
}

// ── Actions ──

interface SwarmActions {
  updateAgents: (agents: AgentEntity[]) => void;
  pushEvent: (event: SwarmEvent) => void;
  updateHud: (hud: HudState) => void;
  setSelectedAgents: (ids: string[]) => void;
  setWsConnected: (connected: boolean) => void;
  updateMetrics: (metrics: SwarmMetrics) => void;
  setExecutionMode: (mode: ExecutionModeValue) => void;
  openTaskResult: (eventId: string) => void;
  closeTaskResult: () => void;
  handleServerMessage: (msg: ServerMessage) => void;
  openRecruitModal: () => void;
  closeRecruitModal: () => void;
  openSettingsModal: (agentId: string) => void;
  closeSettingsModal: () => void;
  recruitAgent: (agent: AgentEntity) => void;
  updateTeamStatus: (status: TeamStatus) => void;
  pushProgressDetail: (detail: TaskProgressDetail) => void;
  openModelLibrary: () => void;
  closeModelLibrary: () => void;
  openSkillPanel: (agentId: string) => void;
  closeSkillPanel: () => void;
  assignModelToAgent: (agentId: string, appearanceJson: string) => void;
  /** Move a selected agent to a new zone (right-click dispatch) */
  moveAgentToZone: (agentId: string, targetZoneId: string) => void;
  /** Move a selected agent to an arbitrary world-space point (right-click ground) */
  moveAgentToPoint: (agentId: string, x: number, z: number, targetZoneId?: string) => void;
  /** Task history panel controls */
  openTaskHistory: () => void;
  closeTaskHistory: () => void;
  /** Mark a zone as active — triggered on first agent entry, no usage limits */
  activateZone: (zoneId: string) => void;
  /** Add a new zone to a group by finding the nearest adjacent free cell */
  addZoneToGroup: (groupId: string, label: string, role: string) => void;
  /** Recruit an agent and place into a specific zone, checking capacity */
  recruitAgentToZone: (agent: AgentEntity, zoneId: string) => void;
  /** Toggle global task panel / speech bubble visibility */
  toggleTaskPanels: () => void;
  /** Group editor panel controls */
  openGroupEditor: (groupId: string) => void;
  closeGroupEditor: () => void;
  /** Update group info (name, description, etc.) */
  updateGroupInfo: (groupId: string, updates: Partial<ZoneFunctionGroup>) => void;
  /** Update group-level base skills */
  updateGroupSkills: (groupId: string, skills: { id: string; version: string }[]) => void;
  /** Remove a zone from a group */
  removeZoneFromGroup: (groupId: string, zoneId: string) => void;
  /** Patch a single agent's fields (status, current_event_id) without replacing the whole array */
  patchAgent: (agentId: string, patch: Partial<Pick<AgentEntity, "status" | "current_event_id">>) => void;

  // ── Agent Summoning & Collaboration Actions ──

  /** Push a new summon request (from server) */
  pushSummonRequest: (request: SummonRequest) => void;
  /** Resolve (remove) a summon request */
  resolveSummonRequest: (requestId: string, resolution: SummonResolution) => void;
  /** Update or create a collaboration session */
  updateCollabSession: (session: ZoneCollabSession) => void;
  /** Update an agent's work state */
  updateAgentWorkState: (state: AgentWorkState) => void;
  /** Push a zone join request (from server) */
  pushJoinRequest: (request: ZoneJoinRequest) => void;
  /** Resolve (remove) a join request */
  resolveJoinRequest: (requestId: string) => void;
  /** Update an agent's status report */
  updateStatusReport: (report: StatusReport) => void;
  /** Set autonomy level for an agent */
  setAgentAutonomy: (agentId: string, level: AutonomyLevel) => void;
}

// ── Store ──

const MAX_EVENTS = 100;

export const useSwarmStore = create<SwarmState & SwarmActions>()((set, get) => ({
  // ── Initial State (demo agents for offline mode) ──
  agents: DEMO_AGENTS,
  events: [],
  hud: createDefaultHud(),
  selectedAgentIds: [],
  wsConnected: false,
  metrics: null,
  hasRealData: false,
  executionMode: "mock",
  selectedTaskEventId: null,
  recruitModalOpen: false,
  settingsModalOpen: false,
  settingsAgentId: null,
  teamStatuses: [],
  progressDetails: [],
  modelLibraryOpen: false,
  skillPanelAgentId: null,
  taskHistoryOpen: false,
  completedTaskMap: new Map(),
  activeZoneIds: ["app", "server", "marketing", "data", "bugs", "compliance"],
  zoneRegistry: [...ZONES],
  groupRegistry: ZONE_FUNCTION_GROUPS.map((g) => ({ ...g, cells: [...g.cells] as [number, number][], zoneIds: [...g.zoneIds] })),
  occupiedCells: new Set(ZONES.map((z) => `${z.col},${z.row}`)),
  taskPanelsVisible: true,
  groupEditorGroupId: null,
  summonRequests: [],
  collabSessions: new Map(),
  agentWorkStates: new Map(),
  pendingJoinRequests: [],
  agentStatusReports: new Map(),

  // ── Actions ──
  updateAgents: (agents) => {
    // Only mark hasRealData when we receive a non-empty agent list.
    // Empty list from a freshly-started gateway should NOT kill demo mode.
    if (agents.length > 0) {
      set({ agents, hasRealData: true });
    }
  },

  pushEvent: (event) =>
    set((state) => {
      const newEvents = [event, ...state.events].slice(0, MAX_EVENTS);

      // Auto-aggregate completed tasks into the persistent map
      if (event.topic === "TASK_CLOSED" || event.topic === "TASK_FAILED") {
        const rootId =
          (event.payload?.original_event_id as string) ||
          event.parent_event_id ||
          event.event_id;

        // Find the root TASK_POSTED event
        const rootTask = newEvents.find(
          (e) => e.event_id === rootId && e.topic === "TASK_POSTED",
        );
        if (rootTask) {
          const related = newEvents.filter(
            (e) =>
              e.event_id === rootId ||
              (e.payload?.original_event_id as string) === rootId ||
              e.parent_event_id === rootId,
          );
          const artifacts = related.filter((e) => e.topic === "ARTIFACT_READY");
          const evidence = related.filter((e) => e.topic === "EVIDENCE_READY");
          const subTasks = related.filter(
            (e) => e.topic === "TASK_POSTED" && e.event_id !== rootId,
          );

          // Aggregate cost
          const closedEvents = related.filter(
            (e) => e.topic === "TASK_CLOSED" || e.topic === "TASK_FAILED",
          );
          let costDelta: CostDelta | null = null;
          const totalCost = closedEvents.reduce(
            (acc, e) => {
              if (e.cost_delta) {
                acc.tokens += e.cost_delta.tokens_used;
                acc.cash += e.cost_delta.cash_used;
                acc.minutes += e.cost_delta.minutes_used;
                acc.hasCost = true;
              }
              return acc;
            },
            { tokens: 0, cash: 0, minutes: 0, hasCost: false },
          );
          if (totalCost.hasCost) {
            costDelta = {
              tokens_used: totalCost.tokens,
              cash_used: totalCost.cash,
              minutes_used: totalCost.minutes,
            };
          } else if (rootTask.cost_delta) {
            costDelta = rootTask.cost_delta;
          }

          const newMap = new Map(state.completedTaskMap);
          newMap.set(rootId, {
            task: { ...rootTask, status: event.topic === "TASK_CLOSED" ? "CLOSED" : "FAILED" },
            artifacts,
            evidence,
            subTasks,
            closedEvent: event,
            costDelta,
            completedAt: event.created_at,
          });
          return { events: newEvents, completedTaskMap: newMap };
        }
      }

      // Also capture artifacts/evidence into existing completed records
      if (event.topic === "ARTIFACT_READY" || event.topic === "EVIDENCE_READY") {
        const rootId =
          (event.payload?.original_event_id as string) ||
          event.parent_event_id;
        if (rootId && state.completedTaskMap.has(rootId)) {
          const newMap = new Map(state.completedTaskMap);
          const record = { ...newMap.get(rootId)! };
          if (event.topic === "ARTIFACT_READY") {
            record.artifacts = [...record.artifacts, event];
          } else {
            record.evidence = [...record.evidence, event];
          }
          newMap.set(rootId, record);
          return { events: newEvents, completedTaskMap: newMap };
        }
      }

      return { events: newEvents };
    }),

  updateHud: (hud) => set({ hud }),

  setSelectedAgents: (ids) => set({ selectedAgentIds: ids }),

  setWsConnected: (connected) => {
    set({ wsConnected: connected });
    // If disconnected and no real data yet, restore demo agents
    if (!connected && !get().hasRealData) {
      set({ agents: DEMO_AGENTS });
    }
  },

  updateMetrics: (metrics) => set({ metrics }),

  setExecutionMode: (mode) => set({ executionMode: mode }),

  openTaskResult: (eventId) => set({ selectedTaskEventId: eventId }),
  closeTaskResult: () => set({ selectedTaskEventId: null }),

  openRecruitModal: () => set({ recruitModalOpen: true }),
  closeRecruitModal: () => set({ recruitModalOpen: false }),
  openSettingsModal: (agentId) => set({ settingsModalOpen: true, settingsAgentId: agentId }),
  closeSettingsModal: () => set({ settingsModalOpen: false, settingsAgentId: null }),

  recruitAgent: (agent) => {
    set((state) => ({
      agents: [...state.agents, agent],
      recruitModalOpen: false,
    }));
  },

  updateTeamStatus: (status) => {
    set((state) => {
      const existing = state.teamStatuses.findIndex((t) => t.teamName === status.teamName);
      const updated = [...state.teamStatuses];
      if (existing >= 0) {
        updated[existing] = status;
      } else {
        updated.push(status);
      }
      // Keep only last 10 teams
      return { teamStatuses: updated.slice(-10) };
    });
  },

  pushProgressDetail: (detail) => {
    set((state) => ({
      progressDetails: [detail, ...state.progressDetails].slice(0, 50),
    }));
  },

  patchAgent: (agentId, patch) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.agent_id === agentId ? { ...a, ...patch } : a,
      ),
    }));
  },

  openModelLibrary: () => set({ modelLibraryOpen: true }),
  closeModelLibrary: () => set({ modelLibraryOpen: false }),
  openSkillPanel: (agentId) => set({ skillPanelAgentId: agentId }),
  closeSkillPanel: () => set({ skillPanelAgentId: null }),
  assignModelToAgent: (agentId, appearanceJson) => set((state) => {
    let parsed: { color_primary?: string; color_secondary?: string; accessory?: string } = {};
    try { parsed = JSON.parse(appearanceJson); } catch { /* ignore */ }
    return {
      agents: state.agents.map((a) =>
        a.agent_id === agentId
          ? {
              ...a,
              appearance: {
                color_primary: parsed.color_primary ?? a.appearance?.color_primary ?? "#60a5fa",
                color_secondary: parsed.color_secondary ?? a.appearance?.color_secondary ?? "#3b82f6",
                accessory: (parsed.accessory as "none") ?? a.appearance?.accessory ?? "none",
              },
            }
          : a,
      ),
    };
  }),

  moveAgentToZone: (agentId, targetZoneId) => {
    const state = get();
    const agent = state.agents.find((a) => a.agent_id === agentId);
    if (!agent || agent.zone_id === targetZoneId) return;

    // 1. Update agent's zone_id
    set((s) => ({
      agents: s.agents.map((a) =>
        a.agent_id === agentId ? { ...a, zone_id: targetZoneId } : a,
      ),
    }));

    // 2. Generate TASK_POSTED + TASK_CLAIMED events to drive AnimationController
    const now = Date.now();
    const taskId = `dispatch-${agentId}-${now}`;
    const ZONE_LABELS: Record<string, string> = {
      app: "App", server: "Server", marketing: "Marketing",
      data: "Data", bugs: "Bugs", compliance: "Compliance",
    };
    const intent = `${agent.name} dispatched to ${ZONE_LABELS[targetZoneId] ?? targetZoneId}`;

    const posted: SwarmEvent = {
      event_id: taskId,
      topic: "TASK_POSTED",
      intent,
      payload: { agent_id: agentId },
      required_tags: [],
      risk_level: "LOW",
      budget: { max_tokens: 1000, max_minutes: 10, max_cash: 1 },
      status: "OPEN",
      claimed_by: agentId,
      created_at: now,
      updated_at: now,
    };
    state.pushEvent(posted);

    // Slight delay for claimed event so AnimationController picks it up in order
    setTimeout(() => {
      const claimed: SwarmEvent = {
        event_id: `${taskId}-claimed`,
        topic: "TASK_CLAIMED",
        intent,
        payload: { agent_id: agentId, zone_id: targetZoneId },
        required_tags: [],
        risk_level: "LOW",
        budget: { max_tokens: 1000, max_minutes: 10, max_cash: 1 },
        status: "CLAIMED",
        claimed_by: agentId,
        parent_event_id: taskId,
        created_at: now + 50,
        updated_at: now + 50,
      };
      get().pushEvent(claimed);
    }, 100);
  },

  moveAgentToPoint: (agentId, x, z, targetZoneId) => {
    const state = get();
    const agent = state.agents.find((a) => a.agent_id === agentId);
    if (!agent) return;

    // Update agent's position + zone_id if entering a new zone
    set((s) => ({
      agents: s.agents.map((a) =>
        a.agent_id === agentId
          ? {
              ...a,
              position: { x, y: 0, z },
              ...(targetZoneId && targetZoneId !== a.zone_id ? { zone_id: targetZoneId } : {}),
            }
          : a,
      ),
    }));

    // Generate DISPATCH_MOVE event to drive AnimationController
    const now = Date.now();
    const moveId = `move-${agentId}-${now}`;

    const moveEvent: SwarmEvent = {
      event_id: moveId,
      topic: "DISPATCH_MOVE" as SwarmEvent["topic"],
      intent: `${agent.name} moving to (${x.toFixed(1)}, ${z.toFixed(1)})`,
      payload: { agent_id: agentId, target_x: x, target_z: z, target_zone_id: targetZoneId },
      required_tags: [],
      risk_level: "LOW",
      budget: { max_tokens: 0, max_minutes: 0, max_cash: 0 },
      status: "CLAIMED",
      claimed_by: agentId,
      created_at: now,
      updated_at: now,
    };
    state.pushEvent(moveEvent);
  },

  openTaskHistory: () => set({ taskHistoryOpen: true }),
  closeTaskHistory: () => set({ taskHistoryOpen: false }),

  activateZone: (zoneId) => {
    const state = get();
    if (state.activeZoneIds.includes(zoneId)) return;
    set({ activeZoneIds: [...state.activeZoneIds, zoneId] });

    const now = Date.now();
    state.pushEvent({
      event_id: `activate-${zoneId}-${now}`,
      topic: "TASK_POSTED" as const,
      intent: `Activated zone: ${zoneId}`,
      payload: { zone_id: zoneId },
      required_tags: [],
      risk_level: "LOW",
      budget: { max_tokens: 0, max_minutes: 0, max_cash: 0 },
      status: "CLOSED",
      claimed_by: undefined,
      created_at: now,
      updated_at: now,
    });
  },

  addZoneToGroup: (groupId, label, role) => {
    const state = get();
    const groupIdx = state.groupRegistry.findIndex((g) => g.id === groupId);
    if (groupIdx === -1) return;
    const group = state.groupRegistry[groupIdx];

    // Find all cells adjacent to the group's current cells
    const cellSet = new Set(group.cells.map(([c, r]) => `${c},${r}`));
    const candidates: [number, number][] = [];
    const seen = new Set<string>();
    for (const [col, row] of group.cells) {
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nc = col + dc;
        const nr = row + dr;
        const key = `${nc},${nr}`;
        if (nc < 0 || nr < 0 || nc > 13 || nr > 11) continue;
        if (cellSet.has(key) || state.occupiedCells.has(key) || seen.has(key)) continue;
        seen.add(key);
        candidates.push([nc, nr]);
      }
    }
    if (candidates.length === 0) return;

    // Pick nearest to group centroid
    let cx = 0, cz = 0;
    for (const [c, r] of group.cells) { cx += c; cz += r; }
    cx /= group.cells.length;
    cz /= group.cells.length;
    candidates.sort((a, b) => {
      const da = (a[0] - cx) ** 2 + (a[1] - cz) ** 2;
      const db = (b[0] - cx) ** 2 + (b[1] - cz) ** 2;
      return da - db;
    });
    const [newCol, newRow] = candidates[0];

    // Create new ZoneDef
    const stride = ZONE_SIZE + ZONE_GAP;
    const gridCenterCol = 5.5;
    const gridCenterRow = 4.5;
    const newId = `zone-${groupId}-${newCol}-${newRow}`;
    const newZone: ZoneDef = {
      id: newId,
      label,
      col: newCol,
      row: newRow,
      position: [
        (newCol - gridCenterCol) * stride,
        0,
        (newRow - gridCenterRow) * stride,
      ],
      color: group.accentColor,
      role,
      capacity: 3,
      initiallyActive: false,
      propOffset: [-1.2, 0, -1.0],
      anvilOffset: [1.2, 0, 0.6],
      propModel: "files",
      propColor: group.accentColor,
    };

    // Update registries
    const newGroups = [...state.groupRegistry];
    newGroups[groupIdx] = {
      ...group,
      zoneIds: [...group.zoneIds, newId],
      cells: [...group.cells, [newCol, newRow]],
    };
    const newOccupied = new Set(state.occupiedCells);
    newOccupied.add(`${newCol},${newRow}`);

    set({
      zoneRegistry: [...state.zoneRegistry, newZone],
      groupRegistry: newGroups,
      occupiedCells: newOccupied,
    });

    const now = Date.now();
    state.pushEvent({
      event_id: `zone-expand-${newId}-${now}`,
      topic: "TASK_POSTED" as const,
      intent: `Expanded territory: ${label} (${role})`,
      payload: { zone_id: newId, group_id: groupId },
      required_tags: [],
      risk_level: "LOW",
      budget: { max_tokens: 0, max_minutes: 0, max_cash: 0 },
      status: "CLOSED",
      claimed_by: undefined,
      created_at: now,
      updated_at: now,
    });
  },

  recruitAgentToZone: (agent, zoneId) => {
    const state = get();
    const zone = state.zoneRegistry.find((z) => z.id === zoneId) ?? ZONE_MAP.get(zoneId);
    if (!zone) return;

    // Count agents currently in this zone
    const occupancy = state.agents.filter((a) => a.zone_id === zoneId).length;
    if (occupancy >= zone.capacity) {
      console.warn(`[SwarmStore] Zone ${zoneId} at capacity (${occupancy}/${zone.capacity})`);
      return;
    }

    // Place agent in zone
    const placed = { ...agent, zone_id: zoneId };
    set((s) => ({
      agents: [...s.agents, placed],
      recruitModalOpen: false,
      activeZoneIds: s.activeZoneIds.includes(zoneId)
        ? s.activeZoneIds
        : [...s.activeZoneIds, zoneId],
    }));
  },

  toggleTaskPanels: () => set((s) => ({ taskPanelsVisible: !s.taskPanelsVisible })),

  openGroupEditor: (groupId) => set({ groupEditorGroupId: groupId }),
  closeGroupEditor: () => set({ groupEditorGroupId: null }),

  updateGroupInfo: (groupId, updates) => set((state) => {
    const idx = state.groupRegistry.findIndex((g) => g.id === groupId);
    if (idx === -1) return state;
    const newGroups = [...state.groupRegistry];
    newGroups[idx] = { ...newGroups[idx], ...updates };
    return { groupRegistry: newGroups };
  }),

  updateGroupSkills: (groupId, skills) => set((state) => {
    const idx = state.groupRegistry.findIndex((g) => g.id === groupId);
    if (idx === -1) return state;
    const newGroups = [...state.groupRegistry];
    newGroups[idx] = { ...newGroups[idx], baseSkills: skills };
    return { groupRegistry: newGroups };
  }),

  removeZoneFromGroup: (groupId, zoneId) => {
    const state = get();
    const groupIdx = state.groupRegistry.findIndex((g) => g.id === groupId);
    if (groupIdx === -1) return;
    const group = state.groupRegistry[groupIdx];

    const zone = state.zoneRegistry.find((z) => z.id === zoneId);
    if (!zone) return;

    // Remove zone from registries
    const newGroups = [...state.groupRegistry];
    newGroups[groupIdx] = {
      ...group,
      zoneIds: group.zoneIds.filter((id) => id !== zoneId),
      cells: group.cells.filter(([c, r]) => !(c === zone.col && r === zone.row)),
    };
    const newOccupied = new Set(state.occupiedCells);
    newOccupied.delete(`${zone.col},${zone.row}`);

    set({
      zoneRegistry: state.zoneRegistry.filter((z) => z.id !== zoneId),
      groupRegistry: newGroups,
      occupiedCells: newOccupied,
      activeZoneIds: state.activeZoneIds.filter((id) => id !== zoneId),
    });
  },

  // ── Agent Summoning & Collaboration Actions ──

  pushSummonRequest: (request) => {
    set((state) => ({
      summonRequests: [...state.summonRequests, request].slice(-20),
    }));
  },

  resolveSummonRequest: (requestId, _resolution) => {
    set((state) => ({
      summonRequests: state.summonRequests.filter((r) => r.request_id !== requestId),
    }));
  },

  updateCollabSession: (session) => {
    set((state) => {
      const newMap = new Map(state.collabSessions);
      newMap.set(session.session_id, session);
      return { collabSessions: newMap };
    });
  },

  updateAgentWorkState: (workState) => {
    set((state) => {
      const newMap = new Map(state.agentWorkStates);
      newMap.set(workState.agent_id, workState);
      return { agentWorkStates: newMap };
    });
  },

  pushJoinRequest: (request) => {
    set((state) => ({
      pendingJoinRequests: [...state.pendingJoinRequests, request].slice(-20),
    }));
  },

  resolveJoinRequest: (requestId) => {
    set((state) => ({
      pendingJoinRequests: state.pendingJoinRequests.filter((r) => r.request_id !== requestId),
    }));
  },

  updateStatusReport: (report) => {
    set((state) => {
      const newMap = new Map(state.agentStatusReports);
      newMap.set(report.agent_id, report);
      return { agentStatusReports: newMap };
    });
  },

  setAgentAutonomy: (agentId, level) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.agent_id === agentId ? { ...a, autonomy_level: level } : a,
      ),
    }));
  },

  handleServerMessage: (msg) => {
    const actions = get();
    switch (msg.type) {
      case "SCENE_STATE":
        actions.updateAgents(msg.agents);
        break;
      case "EVENT_PUSH": {
        actions.pushEvent(msg.event);
        // Extract progress details from TASK_PROGRESS events
        const evt = msg.event;
        if (evt.topic === "TASK_PROGRESS" && evt.payload?.detail) {
          actions.pushProgressDetail({
            eventId: evt.event_id,
            agentId: (evt.payload.agent_id as string) ?? "",
            kind: (evt.payload.kind as string) ?? "text",
            content: (evt.payload.detail as string) ?? "",
            toolName: evt.payload.tool_name as string | undefined,
            timestamp: evt.created_at,
          });
        }
        break;
      }
      case "HUD_UPDATE":
        actions.updateHud(msg.hud);
        break;
      case "METRICS_SNAPSHOT":
        actions.updateMetrics(msg.metrics as unknown as SwarmMetrics);
        break;
      case "TEAM_STATUS":
        actions.updateTeamStatus({
          teamName: msg.teamName,
          members: msg.members,
          timestamp: msg.timestamp,
        });
        break;
      case "MODE_CHANGED":
        actions.setExecutionMode(msg.mode);
        break;
      case "ANIMATION_CMD":
      case "PIP_STREAM_READY":
        break;

      // ── Agent Summoning & Collaboration Messages ──
      case "SUMMON_REQUEST":
        actions.pushSummonRequest(msg.payload);
        break;
      case "SUMMON_RESOLVED":
        actions.resolveSummonRequest(msg.payload.request_id, msg.payload);
        break;
      case "ZONE_JOIN_REQUEST":
        actions.pushJoinRequest(msg.payload);
        break;
      case "COLLAB_SESSION_UPDATE":
        actions.updateCollabSession(msg.payload);
        break;
      case "AGENT_STATUS_REPORT":
        actions.updateStatusReport(msg.payload);
        break;

      default:
        console.warn("[SwarmStore] unhandled message type:", (msg as { type: string }).type);
    }
  },
}));

// ── Derived selectors ──
// NOTE: Zustand selectors must return referentially stable values.
// For filtered arrays, select the raw source and derive with useMemo.

import { useMemo } from "react";

/** Get the latest progress detail for a specific agent (or null) */
export function useLatestProgressForAgent(agentId: string): TaskProgressDetail | null {
  return useSwarmStore((s) => {
    for (const d of s.progressDetails) {
      if (d.agentId === agentId) return d;
    }
    return null;
  });
}

/** Get all progress details for a specific agent */
export function useAgentProgressDetails(agentId: string): TaskProgressDetail[] {
  const all = useSwarmStore((s) => s.progressDetails);
  return useMemo(() => all.filter((d) => d.agentId === agentId), [all, agentId]);
}

/** Get subtask events for a given parent event ID */
export function useSubtasks(parentEventId: string | undefined): import("@corpcraft/contracts").SwarmEvent[] {
  const events = useSwarmStore((s) => s.events);
  return useMemo(() => {
    if (!parentEventId) return EMPTY_EVENTS;
    return events.filter(
      (e) => e.parent_event_id === parentEventId && e.topic === "TASK_POSTED",
    );
  }, [events, parentEventId]);
}

/** Get artifact events related to a task (direct or via subtask parent) */
export function useTaskArtifacts(taskEventId: string | undefined): import("@corpcraft/contracts").SwarmEvent[] {
  const events = useSwarmStore((s) => s.events);
  return useMemo(() => {
    if (!taskEventId) return EMPTY_EVENTS;
    return events.filter(
      (e) =>
        e.topic === "ARTIFACT_READY" &&
        ((e.payload?.original_event_id as string) === taskEventId ||
          e.parent_event_id === taskEventId),
    );
  }, [events, taskEventId]);
}

const EMPTY_EVENTS: import("@corpcraft/contracts").SwarmEvent[] = [];

// ── Summoning & Collaboration selectors ──

/** Get active summon requests */
export function useSummonRequests(): SummonRequest[] {
  return useSwarmStore((s) => s.summonRequests);
}

/** Get collaboration session for a specific zone */
export function useZoneCollabSession(zoneId: string | undefined): ZoneCollabSession | null {
  const sessions = useSwarmStore((s) => s.collabSessions);
  return useMemo(() => {
    if (!zoneId) return null;
    for (const session of sessions.values()) {
      if (session.zone_id === zoneId) return session;
    }
    return null;
  }, [sessions, zoneId]);
}

/** Get all active collaboration sessions */
export function useAllCollabSessions(): ZoneCollabSession[] {
  const sessions = useSwarmStore((s) => s.collabSessions);
  return useMemo(() => [...sessions.values()], [sessions]);
}

/** Get work state for a specific agent */
export function useAgentWorkState(agentId: string): AgentWorkState | null {
  const states = useSwarmStore((s) => s.agentWorkStates);
  return useMemo(() => states.get(agentId) ?? null, [states, agentId]);
}

/** Get status report for a specific agent */
export function useAgentStatusReport(agentId: string): StatusReport | null {
  const reports = useSwarmStore((s) => s.agentStatusReports);
  return useMemo(() => reports.get(agentId) ?? null, [reports, agentId]);
}

/** Get pending join requests */
export function usePendingJoinRequests(): ZoneJoinRequest[] {
  return useSwarmStore((s) => s.pendingJoinRequests);
}
