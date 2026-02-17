"use client";

import { useEffect, useRef } from "react";
import type { SwarmEvent, EventStatus, SummonRequest, ZoneJoinRequest } from "@corpcraft/contracts";
import { useSwarmStore } from "./useSwarmStore";
import { ZONE_IDS } from "@/lib/zone-config";

// ──────────────────────────────────────────────
// useDemoLoop — Generates fake event flow when offline
// Drives the AnimationController to show agents moving,
// forging, and celebrating without a real gateway.
// Also updates agent status + progress so UI indicators render.
//
// v2: Also generates AGENT_SUMMON_REQUEST, ZONE_JOIN_REQUEST,
// and AGENT_TELEPORT_IN events to test the 3D gamified effects
// (SummonFlareEffect, TeleportPillar, InterruptHologram,
// ZoneCollabVisualizer).
// ──────────────────────────────────────────────

const DEMO_INTENTS = [
  "清洗竞品数据并生成分析报告",
  "修复登录页面 token 过期 bug",
  "编写 Q2 营销文案初稿",
  "数据库性能优化方案评审",
  "合规审查：第三方 SDK 权限声明",
  "部署 staging 环境并运行回归测试",
];

const DEMO_THINKING = [
  "分析任务需求，确定执行路径...",
  "检查相关代码上下文...",
  "评估可能的风险点...",
  "规划实现步骤...",
];

const DEMO_TOOLS = [
  "code_search",
  "file_read",
  "run_tests",
  "write_file",
  "lint_check",
  "database_query",
];

const DEMO_SUMMON_REASONS = [
  "需要前端专家协助实现响应式布局",
  "数据库迁移脚本过于复杂，需要 DBA 支援",
  "安全审查需要合规专家介入",
  "性能优化需要基础设施工程师协助",
];

const DEMO_SUMMON_TAGS: string[][] = [
  ["frontend", "react"],
  ["database", "sql"],
  ["security", "compliance"],
  ["infra", "performance"],
];

const DEMO_SUMMON_URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const EVENT_STATUS_MAP: Partial<Record<SwarmEvent["topic"], EventStatus>> = {
  TASK_POSTED: "OPEN",
  TASK_CLAIMED: "CLAIMED",
  TASK_PROGRESS: "RESOLVING",
  ARTIFACT_READY: "RESOLVING",
  TASK_CLOSED: "CLOSED",
  TASK_FAILED: "FAILED",
  AGENT_SUMMON_REQUEST: "CLOSED",
  ZONE_JOIN_REQUEST: "CLOSED",
  AGENT_TELEPORT_IN: "CLOSED",
};

let demoEventCounter = 0;

function makeDemoEvent(
  topic: SwarmEvent["topic"],
  intent: string,
  agentId: string,
  parentId?: string,
  extraPayload?: Record<string, unknown>,
): SwarmEvent {
  demoEventCounter++;
  const now = Date.now();
  return {
    event_id: `demo-evt-${demoEventCounter}-${now}`,
    topic,
    intent,
    payload: { agent_id: agentId, ...extraPayload },
    required_tags: [],
    risk_level: "LOW",
    budget: { max_tokens: 1000, max_minutes: 10, max_cash: 1 },
    status: EVENT_STATUS_MAP[topic] ?? "CLOSED",
    claimed_by: agentId,
    parent_event_id: parentId,
    cost_delta: topic === "TASK_CLOSED"
      ? { tokens_used: 120 + Math.random() * 300, minutes_used: 1, cash_used: 0.01 }
      : undefined,
    created_at: now,
    updated_at: now,
  };
}

export function useDemoLoop() {
  const hasRealData = useSwarmStore((s) => s.hasRealData);
  const pushEvent = useSwarmStore((s) => s.pushEvent);
  const patchAgent = useSwarmStore((s) => s.patchAgent);
  const pushProgressDetail = useSwarmStore((s) => s.pushProgressDetail);
  const pushSummonRequest = useSwarmStore((s) => s.pushSummonRequest);
  const resolveSummonRequest = useSwarmStore((s) => s.resolveSummonRequest);
  const pushJoinRequest = useSwarmStore((s) => s.pushJoinRequest);
  const resolveJoinRequest = useSwarmStore((s) => s.resolveJoinRequest);
  const agents = useSwarmStore((s) => s.agents);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    if (hasRealData) {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const t of pendingTimers.current) clearTimeout(t);
      pendingTimers.current = [];
      return;
    }

    function schedule(fn: () => void, ms: number) {
      const t = setTimeout(fn, ms);
      pendingTimers.current.push(t);
      return t;
    }

    function runDemoCycle() {
      const seq = seqRef.current++;
      const agentIdx = seq % agents.length;
      const agent = agents[agentIdx];
      if (!agent) return;

      const intent = DEMO_INTENTS[seq % DEMO_INTENTS.length];
      const zoneId = agent.zone_id ?? ZONE_IDS[seq % ZONE_IDS.length];
      const agentId = agent.agent_id;

      // Every 4th cycle: trigger a summon request + join request demo
      if (seq % 4 === 3 && agents.length >= 2) {
        runSummonDemoCycle(seq, agentId, agent.name, zoneId);
      } else {
        runNormalDemoCycle(seq, intent, agentId, zoneId);
      }

      // Schedule next cycle (stagger between 4-7 seconds)
      const delay = 4000 + Math.random() * 3000;
      timerRef.current = setTimeout(runDemoCycle, delay);
    }

    function runNormalDemoCycle(
      seq: number,
      intent: string,
      agentId: string,
      zoneId: string,
    ) {
      // Phase 1 (t=0): TASK_POSTED + set agent to CLAIMED with current_event_id
      const posted = makeDemoEvent("TASK_POSTED", intent, agentId);
      pushEvent(posted);
      patchAgent(agentId, { status: "CLAIMED", current_event_id: posted.event_id });

      // Phase 2 (t=800ms): TASK_CLAIMED + set agent to EXEC_TOOL
      schedule(() => {
        const claimed = makeDemoEvent("TASK_CLAIMED", intent, agentId, posted.event_id, {
          zone_id: zoneId,
        });
        pushEvent(claimed);
        patchAgent(agentId, { status: "EXEC_TOOL" });
      }, 800);

      // Phase 3 (t=2s): TASK_PROGRESS — thinking
      schedule(() => {
        const thinkingText = DEMO_THINKING[seq % DEMO_THINKING.length];
        const progress = makeDemoEvent("TASK_PROGRESS", intent, agentId, posted.event_id, {
          kind: "thinking",
          detail: thinkingText,
          progress: 25,
          message: thinkingText,
        });
        pushEvent(progress);
        pushProgressDetail({
          eventId: progress.event_id,
          agentId,
          kind: "thinking",
          content: thinkingText,
          timestamp: Date.now(),
        });
      }, 2000);

      // Phase 4 (t=3.5s): TASK_PROGRESS — tool_use
      schedule(() => {
        const toolName = DEMO_TOOLS[seq % DEMO_TOOLS.length];
        const progress = makeDemoEvent("TASK_PROGRESS", intent, agentId, posted.event_id, {
          kind: "tool_use",
          tool_name: toolName,
          detail: `Executing ${toolName}`,
          progress: 60,
          message: `Using ${toolName}`,
        });
        pushEvent(progress);
        pushProgressDetail({
          eventId: progress.event_id,
          agentId,
          kind: "tool_use",
          content: `Executing ${toolName}`,
          toolName,
          timestamp: Date.now(),
        });
      }, 3500);

      // Phase 5 (t=5s): ARTIFACT_READY
      schedule(() => {
        const artifact = makeDemoEvent("ARTIFACT_READY", intent, agentId, posted.event_id, {
          artifact_type: "result",
          content: `[Demo] ${intent} 完成结果预览`,
          success: true,
        });
        pushEvent(artifact);
      }, 5000);

      // Phase 6 (t=6s): TASK_CLOSED + reset agent to IDLE
      schedule(() => {
        const closed = makeDemoEvent("TASK_CLOSED", intent, agentId, posted.event_id);
        pushEvent(closed);
        patchAgent(agentId, { status: "IDLE", current_event_id: undefined });
      }, 6000);
    }

    function runSummonDemoCycle(
      seq: number,
      agentId: string,
      agentName: string,
      zoneId: string,
    ) {
      const summonIdx = Math.floor(seq / 4) % DEMO_SUMMON_REASONS.length;
      const now = Date.now();
      const requestId = `demo-summon-${demoEventCounter++}-${now}`;

      // Phase 1 (t=0): Agent fires a summon request (red flare effect)
      const summonEvent = makeDemoEvent(
        "AGENT_SUMMON_REQUEST",
        `Agent ${agentName} 请求支援: ${DEMO_SUMMON_REASONS[summonIdx]}`,
        agentId,
        undefined,
        {
          requesting_agent_id: agentId,
          requesting_agent_name: agentName,
          reason: "SKILL_GAP",
          required_tags: DEMO_SUMMON_TAGS[summonIdx],
          urgency: DEMO_SUMMON_URGENCIES[summonIdx % DEMO_SUMMON_URGENCIES.length],
          context: DEMO_SUMMON_REASONS[summonIdx],
          target_zone_id: zoneId,
        },
      );
      pushEvent(summonEvent);

      const summonRequest: SummonRequest = {
        request_id: requestId,
        requesting_agent_id: agentId,
        requesting_agent_name: agentName,
        reason: "SKILL_GAP",
        required_tags: DEMO_SUMMON_TAGS[summonIdx],
        urgency: DEMO_SUMMON_URGENCIES[summonIdx % DEMO_SUMMON_URGENCIES.length],
        target_zone_id: zoneId,
        context: DEMO_SUMMON_REASONS[summonIdx],
        approval_timeout_ms: 15000,
        created_at: now,
      };
      pushSummonRequest(summonRequest);

      // Phase 2 (t=3s): Simulate a second agent requesting to join a zone
      schedule(() => {
        const otherAgent = agents.find((a) => a.agent_id !== agentId);
        if (!otherAgent) return;

        const joinRequestId = `demo-join-${demoEventCounter++}-${Date.now()}`;
        const joinEvent = makeDemoEvent(
          "ZONE_JOIN_REQUEST",
          `${otherAgent.name} 请求加入区域 ${zoneId}`,
          otherAgent.agent_id,
          undefined,
          {
            agent_id: otherAgent.agent_id,
            agent_name: otherAgent.name,
            zone_id: zoneId,
            trigger: "SUMMON",
          },
        );
        pushEvent(joinEvent);

        const joinRequest: ZoneJoinRequest = {
          request_id: joinRequestId,
          agent_id: otherAgent.agent_id,
          agent_name: otherAgent.name,
          zone_id: zoneId,
          trigger: "SUMMON",
          timeout_ms: 15000,
          created_at: Date.now(),
        };
        pushJoinRequest(joinRequest);

        // Phase 3 (t=8s): Auto-resolve the join request (timeout or approval)
        schedule(() => {
          resolveJoinRequest(joinRequestId);
        }, 5000);
      }, 3000);

      // Phase 4 (t=5s): Simulate teleport-in (golden pillar) for newly recruited agent
      schedule(() => {
        const recruitAgent = agents[(agents.indexOf(agents.find((a) => a.agent_id !== agentId) ?? agents[0]) + 1) % agents.length];
        if (!recruitAgent) return;

        const teleportEvent = makeDemoEvent(
          "AGENT_TELEPORT_IN",
          `${recruitAgent.name} 降临到区域 ${zoneId}`,
          recruitAgent.agent_id,
          undefined,
          {
            agent_id: recruitAgent.agent_id,
            zone_id: zoneId,
          },
        );
        pushEvent(teleportEvent);
      }, 5000);

      // Phase 5 (t=8s): Auto-resolve summon request
      schedule(() => {
        resolveSummonRequest(requestId, {
          request_id: requestId,
          decision: "AUTO_APPROVED",
          decided_by: "SYSTEM",
          matched_agent_id: agents[1]?.agent_id ?? agentId,
          created_at: Date.now(),
        });
      }, 8000);
    }

    // Start after a brief initial delay
    timerRef.current = setTimeout(runDemoCycle, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const t of pendingTimers.current) clearTimeout(t);
      pendingTimers.current = [];
    };
  }, [hasRealData, agents, pushEvent, patchAgent, pushProgressDetail, pushSummonRequest, resolveSummonRequest, pushJoinRequest, resolveJoinRequest]);
}
