// ──────────────────────────────────────────────
// Gateway Server — Main Entry Point
// Wired: PolicyAuditService + AssetRegistry
// ──────────────────────────────────────────────

import { randomUUID } from "node:crypto";
import path from "node:path";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import WebSocket from "ws";

import { InMemoryEventBus, DEFAULT_LEASE_MS } from "@corpcraft/event-bus";
import type { EventFilter } from "@corpcraft/event-bus";
import { SwarmEngine } from "@corpcraft/swarm-engine";
import { PolicyAuditService } from "@corpcraft/policy-audit";
import { AssetRegistry } from "@corpcraft/asset-registry";
import { createSwarmEvent, getSeedAgents } from "@corpcraft/contracts";
import type {
  CreateIntentRequest,
  CreateIntentResponse,
  ClaimRequest,
  ClaimResponse,
  CompleteRequest,
  HeartbeatResponse,
  AgentListResponse,
  EquipSkillsRequest,
  NotImplementedResponse,
  ServerMessage,
  SkillManifest,
  SetExecutionModeRequest,
  ExecutionModeResponse,
  ModeChangedMsg,
  ExecutionModeValue,
} from "@corpcraft/contracts";

import { EventBusBridge } from "./bridge.js";
import { handleClientMessage, type OutboundMessage } from "./handlers.js";

const PORT = Number(process.env.PORT ?? 3002);
const EXECUTION_MODE = process.env.CORPCRAFT_EXECUTION_MODE ?? "mock";

// Resolve assets dir: import.meta.dirname is src/ dir → go up 3 levels
// Fallback: from CWD (apps/gateway/) go up 2 levels
const ASSETS_DIR = import.meta.dirname
  ? path.resolve(import.meta.dirname, "../../../assets")
  : path.resolve("../../assets");

async function main(): Promise<void> {
  const app = Fastify({ logger: true });

  // ── Plugins ──
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  await app.register(websocket);

  // ── Dependencies ──
  const bus = new InMemoryEventBus();
  const engine = new SwarmEngine(bus);
  const policyAudit = new PolicyAuditService(bus);
  const assetRegistry = new AssetRegistry(bus);

  // Register seed agents so the matcher has agents to work with
  for (const agent of getSeedAgents()) {
    engine.matcher.registerAgent(agent);
  }
  console.log(`[Gateway] Registered ${getSeedAgents().length} seed agents`);

  engine.init();
  policyAudit.init();

  // Log execution mode
  console.log(`[Gateway] Execution mode: ${EXECUTION_MODE}`);
  if (EXECUTION_MODE === "claude" || EXECUTION_MODE === "team") {
    // Claude Code reads config from ~/.claude/settings.json
    console.log("[Gateway] Claude Code subprocess engine active");
    console.log("[Gateway] Config source: ~/.claude/settings.json (BigModel Coding Plan)");
    if (EXECUTION_MODE === "team") {
      console.log("[Gateway] Agent Teams mode enabled (--agents multi-agent orchestration)");
    }
  }

  // Load assets from disk (best-effort)
  try {
    await assetRegistry.loadSkillsFromDir(path.join(ASSETS_DIR, "skills"));
    await assetRegistry.loadAgentsFromDir(path.join(ASSETS_DIR, "agents"));
    await assetRegistry.loadProjectConfig(path.join(ASSETS_DIR, "AGENTS.md"));
    console.log(
      `[AssetRegistry] Loaded ${assetRegistry.getSkills().length} skills`,
    );
  } catch (err) {
    console.warn("[AssetRegistry] Could not load assets:", err);
  }

  // Handler deps (broadcast added for MODE_CHANGED support)
  const handlerDeps = { engine, policyAudit, broadcast };

  // Track connected WebSocket clients
  const clients = new Set<WebSocket>();

  function broadcast(msg: ServerMessage): void {
    const payload = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  // ── Event bus → WebSocket bridge ──
  const bridge = new EventBusBridge(bus, broadcast);
  bridge.setSwarmEngine(engine);

  // ────────────────────────────────────────────
  // REST Routes
  // ────────────────────────────────────────────

  // POST /api/intents
  app.post<{ Body: CreateIntentRequest }>(
    "/api/intents",
    async (req, reply) => {
      const { intent, budget, risk_level } = req.body;
      const event = await engine.router.routeIntent(intent, {
        budget,
        risk_level,
      });
      const response: CreateIntentResponse = { event };
      return reply.code(201).send(response);
    },
  );

  // GET /api/events
  app.get<{ Querystring: Record<string, string | undefined> }>(
    "/api/events",
    async (req, reply) => {
      const filter: EventFilter = {};
      if (req.query.status)
        filter.status = req.query.status as EventFilter["status"];
      if (req.query.topic)
        filter.topic = req.query.topic as EventFilter["topic"];
      if (req.query.limit) filter.limit = Number(req.query.limit);
      if (req.query.offset) filter.offset = Number(req.query.offset);
      const events = await bus.query(filter);
      return reply.send({ events });
    },
  );

  // POST /api/events/:id/claim
  app.post<{ Params: { id: string }; Body: ClaimRequest }>(
    "/api/events/:id/claim",
    async (req, reply) => {
      const result = await bus.claim(
        req.params.id,
        req.body.agent_id,
        req.body.lease_ms,
      );
      const response: ClaimResponse = result.ok
        ? { ok: true, lease_expiry: result.lease_expiry }
        : { ok: false, reason: result.reason };
      return reply.send(response);
    },
  );

  // POST /api/events/:id/heartbeat
  app.post<{ Params: { id: string }; Body: { agent_id: string } }>(
    "/api/events/:id/heartbeat",
    async (req, reply) => {
      const ok = await bus.heartbeat(req.params.id, req.body.agent_id);
      const response: HeartbeatResponse = {
        ok,
        renewed_until: ok ? Date.now() + DEFAULT_LEASE_MS : undefined,
      };
      return reply.send(response);
    },
  );

  // POST /api/events/:id/complete
  app.post<{ Params: { id: string }; Body: CompleteRequest }>(
    "/api/events/:id/complete",
    async (req, reply) => {
      const event = await bus.getEvent(req.params.id);
      if (!event) {
        return reply.code(404).send({ error: "Event not found" });
      }
      event.status = "CLOSED";
      event.updated_at = Date.now();
      if (req.body.cost_delta) {
        event.cost_delta = req.body.cost_delta;
      }
      await bus.release(event.event_id, req.body.agent_id);
      await bus.publish(
        createSwarmEvent({
          event_id: randomUUID(),
          topic: "TASK_CLOSED",
          intent: event.intent,
          payload: {
            original_event_id: event.event_id,
            agent_id: req.body.agent_id,
            artifacts: req.body.artifacts ?? [],
          },
          parent_event_id: event.event_id,
          cost_delta: req.body.cost_delta,
          status: "CLOSED",
        }),
      );
      return reply.send({ ok: true });
    },
  );

  // GET /api/agents
  app.get("/api/agents", async (_req, reply) => {
    const response: AgentListResponse = { agents: engine.getAgents() };
    return reply.send(response);
  });

  // PATCH /api/agents/:id/equip
  app.patch<{ Params: { id: string }; Body: EquipSkillsRequest }>(
    "/api/agents/:id/equip",
    async (req, reply) => {
      const agent = engine.matcher.getAgent(req.params.id);
      if (!agent) {
        return reply.code(404).send({ error: "Agent not found" });
      }
      // Update equipped skills on the agent entity
      agent.equipped_skills = req.body.skill_ids;
      return reply.send({ ok: true, equipped: agent.equipped_skills });
    },
  );

  // ────────────────────────────────────────────
  // Execution Mode Routes
  // ────────────────────────────────────────────

  // GET /api/execution-mode → current mode
  app.get("/api/execution-mode", async (_req, reply) => {
    const response: ExecutionModeResponse = { mode: engine.getExecutionMode() as ExecutionModeValue };
    return reply.send(response);
  });

  // POST /api/execution-mode → change mode at runtime
  app.post<{ Body: SetExecutionModeRequest }>(
    "/api/execution-mode",
    async (req, reply) => {
      const { mode } = req.body;
      if (mode !== "mock" && mode !== "claude" && mode !== "team") {
        return reply.code(400).send({ error: "Invalid mode. Must be mock, claude, or team." });
      }
      engine.setExecutionMode(mode);
      console.log(`[Gateway] Execution mode changed to: ${mode}`);
      // Broadcast to all WS clients
      const modeMsg: ModeChangedMsg = {
        type: "MODE_CHANGED",
        mode,
        timestamp: Date.now(),
      };
      broadcast(modeMsg);
      const response: ExecutionModeResponse = { mode };
      return reply.send(response);
    },
  );

  // ────────────────────────────────────────────
  // Approval Routes (wired to PolicyAuditService)
  // ────────────────────────────────────────────

  // GET /api/approvals → list pending approvals
  app.get("/api/approvals", async (_req, reply) => {
    const pending = policyAudit.getPendingApprovals();
    return reply.send({ approvals: pending });
  });

  // POST /api/approvals/:id/decision → approve or reject
  app.post<{
    Params: { id: string };
    Body: {
      decision: "APPROVE" | "REJECT";
      decided_by: string;
      reason?: string;
    };
  }>("/api/approvals/:id/decision", async (req, reply) => {
    await policyAudit.decide(
      req.params.id,
      req.body.decision,
      req.body.decided_by,
      req.body.reason,
    );
    return reply.send({ ok: true });
  });

  // GET /api/audit-log → audit trail
  app.get<{ Querystring: { task_id?: string } }>(
    "/api/audit-log",
    async (req, reply) => {
      const log = policyAudit.getAuditLog(req.query.task_id);
      return reply.send({ log });
    },
  );

  // GET /api/approval-stats → approval latency stats
  app.get("/api/approval-stats", async (_req, reply) => {
    const stats = policyAudit.getApprovalStats();
    return reply.send({ stats });
  });

  // ────────────────────────────────────────────
  // Asset Routes (wired to AssetRegistry)
  // ────────────────────────────────────────────

  // GET /api/assets/skills → list all loaded skills
  app.get("/api/assets/skills", async (_req, reply) => {
    return reply.send({ skills: assetRegistry.getSkills() });
  });

  // POST /api/assets/skills/install → install a skill (with security gate)
  app.post<{ Body: SkillManifest }>(
    "/api/assets/skills/install",
    async (req, reply) => {
      const result = await assetRegistry.installSkill(req.body);
      const code = result.allowed ? 200 : 403;
      return reply.code(code).send(result);
    },
  );

  // GET /api/assets/agents → list agent.md configs
  app.get("/api/assets/agents", async (_req, reply) => {
    const agents = assetRegistry.getAgents();
    const list = Array.from(agents.entries()).map(([name, config]) => ({
      name,
      ...config,
    }));
    return reply.send({ agents: list });
  });

  // GET /api/assets/project → AGENTS.md project config
  app.get("/api/assets/project", async (_req, reply) => {
    const config = assetRegistry.getProjectConfig();
    if (!config) {
      return reply.code(404).send({ error: "No AGENTS.md loaded" });
    }
    return reply.send(config);
  });

  // ────────────────────────────────────────────
  // System Routes
  // ────────────────────────────────────────────

  app.get("/api/health", async (_req, reply) => {
    return reply.send({
      status: "HEALTHY",
      service: "gateway",
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  app.get("/api/metrics", async (_req, reply) => {
    const metrics = engine.getMetrics();
    return reply.send({ metrics });
  });

  app.get("/api/hud", async (_req, reply) => {
    const hud = engine.getHudState();
    return reply.send({ hud });
  });

  app.get<{ Querystring: { limit?: string } }>(
    "/api/dlq",
    async (req, reply) => {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const entries = await bus.getDLQ(limit);
      return reply.send({ entries, count: entries.length });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/dlq/:id/retry",
    async (req, reply) => {
      await bus.retryFromDLQ(req.params.id);
      return reply.send({ ok: true });
    },
  );

  // ── Placeholder 501s ──

  app.post("/api/simulation/scenarios", async (_req, reply) => {
    const resp: NotImplementedResponse = {
      error: "NOT_IMPLEMENTED",
      message: "Simulation scenarios — target Sprint 5",
      target_sprint: 5,
    };
    return reply.code(501).send(resp);
  });

  app.post("/api/simulation/run", async (_req, reply) => {
    const resp: NotImplementedResponse = {
      error: "NOT_IMPLEMENTED",
      message: "Simulation run — target Sprint 5",
      target_sprint: 5,
    };
    return reply.code(501).send(resp);
  });

  app.get("/api/intel/reports", async (_req, reply) => {
    const resp: NotImplementedResponse = {
      error: "NOT_IMPLEMENTED",
      message: "Intel reports — target Sprint 4",
      target_sprint: 4,
    };
    return reply.code(501).send(resp);
  });

  // ────────────────────────────────────────────
  // WebSocket Route
  // ────────────────────────────────────────────

  app.register(async (fastify) => {
    fastify.get("/ws", { websocket: true }, (socket, _req) => {
      const ws = socket as unknown as WebSocket;
      clients.add(ws);
      console.log(`[WS] Client connected (total: ${clients.size})`);

      ws.on("message", async (data) => {
        const raw = typeof data === "string" ? data : String(data);
        await handleClientMessage(raw, handlerDeps, (msg: OutboundMessage) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        });
      });

      ws.on("close", () => {
        clients.delete(ws);
        console.log(`[WS] Client disconnected (total: ${clients.size})`);
      });

      ws.on("error", (err) => {
        console.error("[WS] Socket error:", err);
        clients.delete(ws);
      });
    });
  });

  // ── Start server ──
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[Gateway] Listening on http://0.0.0.0:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ── Graceful shutdown ──
  const shutdown = async (): Promise<void> => {
    console.log("[Gateway] Shutting down...");
    bridge.shutdown();
    policyAudit.shutdown();
    await engine.shutdown();
    await bus.shutdown();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
