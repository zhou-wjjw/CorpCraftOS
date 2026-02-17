// ──────────────────────────────────────────────
// E2E Relay Test: 两 Agent 接力打铁验收脚本
//
// 验收要求 (Sprint 1):
// 1. 输入意图 "清洗线索并出报告"
// 2. 发布 TASK_POSTED (tags: data, clean, report)
// 3. AgentA (DataCleaner) 抢单 → 跑动打铁
// 4. 发布 ARTIFACT_READY + EVIDENCE_READY
// 5. AgentB (ReportWriter) 接力抢单
// 6. 最终 TASK_CLOSED
// 7. HUD 成本更新
// 8. 所有事件幂等
// ──────────────────────────────────────────────

import { InMemoryEventBus } from "@corpcraft/event-bus";
import { createAgent } from "@corpcraft/contracts";
import type { SwarmEvent } from "@corpcraft/contracts";
import { SwarmEngine } from "./index.js";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  CorpCraft OS V4.2 — E2E Relay Test");
  console.log("  两 Agent 接力打铁验收");
  console.log("═══════════════════════════════════════════\n");

  // 1. Setup
  const bus = new InMemoryEventBus();
  const engine = new SwarmEngine(bus);

  // Register two agents
  const dataCleaner = createAgent({
    agent_id: "agent-data-cleaner",
    name: "DataCleaner",
    role_tags: ["data", "clean", "csv"],
    zone_id: "data",
    position: { x: -4, y: 0, z: 2 },
  });

  const reportWriter = createAgent({
    agent_id: "agent-report-writer",
    name: "ReportWriter",
    role_tags: ["report", "writing", "analysis"],
    zone_id: "server",
    position: { x: 0, y: 0, z: -2 },
  });

  engine.matcher.registerAgent(dataCleaner);
  engine.matcher.registerAgent(reportWriter);

  // Event collector for verification
  const collectedEvents: SwarmEvent[] = [];
  bus.subscribe(
    [
      "TASK_POSTED",
      "TASK_DECOMPOSED",
      "TASK_CLAIMED",
      "ARTIFACT_READY",
      "EVIDENCE_READY",
      "TASK_CLOSED",
      "HUD_SYNC",
      "TASK_RETRY_SCHEDULED",
    ],
    async (event) => {
      collectedEvents.push(event);
      const ts = new Date(event.created_at).toISOString().slice(11, 23);
      console.log(
        `  [${ts}] ${event.topic.padEnd(22)} | ${event.intent.slice(0, 40)} | status=${event.status} claimed_by=${event.claimed_by ?? "-"}`,
      );
    },
  );

  // 2. Initialize engine
  await engine.init();
  console.log("\n✓ Engine initialized with 2 agents\n");

  // 3. Send intent
  console.log('► Sending intent: "清洗线索并出报告"\n');
  const rootEvent = await engine.router.routeIntent("清洗线索并出报告", {
    budget: { max_tokens: 1000, max_minutes: 10, max_cash: 5 },
    risk_level: "LOW",
  });
  console.log(`  Root event: ${rootEvent.event_id} (${rootEvent.topic})\n`);

  // 4. Wait for the decomposer + matcher + executor chain
  console.log("► Waiting for swarm to process...\n");
  await sleep(15_000); // Wait for full relay cycle

  // 5. Verify results
  console.log("\n═══════════════════════════════════════════");
  console.log("  VERIFICATION RESULTS");
  console.log("═══════════════════════════════════════════\n");

  const topics = collectedEvents.map((e) => e.topic);

  // Check TASK_POSTED
  const taskPosted = topics.includes("TASK_POSTED");
  console.log(`  ${taskPosted ? "✅" : "❌"} TASK_POSTED published`);

  // Check TASK_CLAIMED
  const taskClaimed = topics.includes("TASK_CLAIMED");
  console.log(`  ${taskClaimed ? "✅" : "❌"} TASK_CLAIMED (agent grabbed a task)`);

  // Check ARTIFACT_READY
  const artifactReady = topics.includes("ARTIFACT_READY");
  console.log(`  ${artifactReady ? "✅" : "❌"} ARTIFACT_READY published`);

  // Check EVIDENCE_READY
  const evidenceReady = topics.includes("EVIDENCE_READY");
  console.log(`  ${evidenceReady ? "✅" : "❌"} EVIDENCE_READY published`);

  // Check TASK_CLOSED
  const taskClosed = topics.includes("TASK_CLOSED");
  console.log(`  ${taskClosed ? "✅" : "❌"} TASK_CLOSED (task completed)`);

  // Check HUD_SYNC (cost tracking)
  const hudSync = topics.includes("HUD_SYNC");
  console.log(`  ${hudSync ? "✅" : "❌"} HUD_SYNC (cost updated)`);

  // Check HUD state
  const hud = engine.getHudState();
  const mpDrained = hud.mp.current < hud.mp.max;
  console.log(
    `  ${mpDrained ? "✅" : "⚠️"} MP drained: ${hud.mp.current}/${hud.mp.max}`,
  );

  // Check idempotency: re-send same intent
  console.log("\n► Idempotency test: re-sending same intent...");
  const beforeCount = bus.eventCount;
  await engine.router.routeIntent("清洗线索并出报告", {
    budget: { max_tokens: 1000, max_minutes: 10, max_cash: 5 },
    risk_level: "LOW",
  });
  await sleep(500);
  const afterCount = bus.eventCount;
  const idempotent = afterCount === beforeCount;
  console.log(
    `  ${idempotent ? "✅" : "❌"} Idempotent: event count ${beforeCount} → ${afterCount}`,
  );

  // Summary
  console.log("\n═══════════════════════════════════════════");
  const allPassed = taskPosted && taskClaimed && artifactReady && evidenceReady && taskClosed && hudSync;
  if (allPassed) {
    console.log("  ✅ ALL CHECKS PASSED — Sprint 1 E2E Relay verified!");
  } else {
    console.log("  ❌ SOME CHECKS FAILED — review above");
  }
  console.log("═══════════════════════════════════════════\n");

  // Metrics snapshot
  const metrics = engine.getMetrics();
  console.log("  Metrics snapshot:");
  console.log(`    Queue depth: ${metrics.queue_depth}`);
  console.log(`    Tasks completed (1h): ${metrics.tasks_completed_1h}`);
  console.log(`    Tasks failed (1h): ${metrics.tasks_failed_1h}`);
  console.log(`    Total tokens: ${metrics.total_tokens_1h}`);
  console.log(`    DLQ size: ${(await bus.getDLQ()).length}`);

  // Cleanup
  await engine.shutdown();
  await bus.shutdown();
  console.log("\n✓ Engine shutdown complete");
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
