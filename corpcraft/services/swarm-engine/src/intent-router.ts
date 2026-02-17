// ──────────────────────────────────────────────
// IntentRouter: 意图路由 → TASK_POSTED
// ──────────────────────────────────────────────

import type { SwarmEvent, Budget, RiskLevel } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus } from "@corpcraft/event-bus";

// ── Helpers ──

/** DJB2-style hash → base-36 string (deterministic, fast) */
function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** 5-minute time bucket for idempotency grouping */
function timeBucket(): string {
  return String(Math.floor(Date.now() / (5 * 60_000)));
}

// ── Tag patterns: keyword → tag set ──

// Tags MUST match seed agent role_tags. Each rule assigns tags independently.
// Agent tags: Codex["dev","code"], Claude["report","writing"], Gemini["data","analysis"],
//             Cursor["dev","bugs"], Admin["review","approval"]
const TAG_RULES: Array<{ pattern: RegExp; tags: string[] }> = [
  { pattern: /数据|data|清洗|clean|分析|analy/i, tags: ["data"] },
  { pattern: /报告|report|写作|writ/i, tags: ["report"] },
  { pattern: /营销|market|增长|growth/i, tags: ["growth"] },
  { pattern: /代码|code|开发|dev|构建|build|实现|implement/i, tags: ["dev"] },
  { pattern: /bug|缺陷|修复|fix|调试|debug/i, tags: ["bugs"] },
  { pattern: /审核|review|合规|compliance|审批|approv/i, tags: ["review"] },
];

function parseTags(intent: string): string[] {
  const result = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.pattern.test(intent)) {
      for (const t of rule.tags) result.add(t);
    }
  }
  return Array.from(result);
}

// ── Public interface ──

export interface RouteIntentOptions {
  budget?: Budget;
  risk_level?: RiskLevel;
  tags?: string[];
}

export class IntentRouter {
  constructor(private readonly bus: IEventBus) {}

  /**
   * Parse an intent string, generate tags, produce an idempotency key,
   * and publish a TASK_POSTED event.
   */
  async routeIntent(
    intent: string,
    options?: RouteIntentOptions,
  ): Promise<SwarmEvent> {
    const idempotency_key = simpleHash(intent + timeBucket());
    const autoTags = parseTags(intent);
    const allTags = [...new Set([...autoTags, ...(options?.tags ?? [])])];

    const event = createSwarmEvent({
      event_id: crypto.randomUUID(),
      topic: "TASK_POSTED",
      intent,
      required_tags: allTags,
      risk_level: options?.risk_level ?? "LOW",
      budget: options?.budget ?? {},
      idempotency_key,
    });

    return this.bus.publish(event);
  }
}
