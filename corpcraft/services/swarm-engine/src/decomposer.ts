// ──────────────────────────────────────────────
// Decomposer: TASK_POSTED → sub-tasks
// ──────────────────────────────────────────────

import type { SwarmEvent } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

// ── Category detection ──

interface CategoryMatch {
  category: string;
  tags: string[];
}

// Tags must match seed agent role_tags for proper matching
const CATEGORIES: CategoryMatch[] = [
  { category: "data", tags: ["data"] },
  { category: "report", tags: ["report"] },
  { category: "growth", tags: ["growth"] },
  { category: "dev", tags: ["dev"] },
  { category: "bugs", tags: ["bugs"] },
  { category: "review", tags: ["review"] },
];

const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  data: /数据|data|清洗|clean|分析|analy/i,
  report: /报告|report|写作|writ/i,
  growth: /营销|market|增长|growth/i,
  dev: /代码|code|开发|dev|构建|build|实现|implement/i,
  bugs: /bug|缺陷|修复|fix|调试|debug/i,
  review: /审核|review|合规|compliance|审批|approv/i,
};

function detectCategories(intent: string): CategoryMatch[] {
  const matched: CategoryMatch[] = [];
  for (const cat of CATEGORIES) {
    const regex = CATEGORY_KEYWORDS[cat.category];
    if (regex && regex.test(intent)) {
      matched.push(cat);
    }
  }
  return matched;
}

// ── Decomposer class ──

const MAX_PROCESSED = 2000;

export class Decomposer {
  private unsubscribe: Unsubscribe | null = null;
  /** Idempotency guard – skip events already decomposed (bounded) */
  private processedEvents = new Set<string>();

  /**
   * @param bus Event bus
   * @param getMode Optional getter for current execution mode.
   *   When provided, decomposition only happens in "team" mode.
   *   In "claude" mode, a single agent handles the entire task.
   */
  constructor(
    private readonly bus: IEventBus,
    private readonly getMode?: () => string,
  ) {}

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["TASK_POSTED"],
      this.handleTaskPosted.bind(this),
    );
  }

  // ── Handler ──

  private async handleTaskPosted(event: SwarmEvent): Promise<void> {
    // Idempotent: already processed
    if (this.processedEvents.has(event.event_id)) return;
    // Sub-tasks should not be re-decomposed
    if (event.parent_event_id) return;
    // Retry tasks should not be re-decomposed
    if (event.payload?.retry_of) return;
    // Only decompose in team mode — in claude mode a single agent handles everything
    if (this.getMode && this.getMode() !== "team") return;

    // Bounded cleanup for processedEvents
    if (this.processedEvents.size > MAX_PROCESSED) {
      const toDelete: string[] = [];
      let count = 0;
      for (const id of this.processedEvents) {
        if (count++ >= MAX_PROCESSED / 4) break;
        toDelete.push(id);
      }
      for (const id of toDelete) this.processedEvents.delete(id);
    }

    const categories = detectCategories(event.intent);
    // Only decompose when multiple distinct categories are detected
    if (categories.length <= 1) return;

    // Mark as processed SYNCHRONOUSLY so concurrent handlers
    // (e.g. Matcher) see the updated status before their first await.
    this.processedEvents.add(event.event_id);
    event.status = "RESOLVING";
    event.updated_at = Date.now();

    // Publish TASK_DECOMPOSED
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "TASK_DECOMPOSED",
        intent: event.intent,
        payload: {
          original_event_id: event.event_id,
          sub_task_count: categories.length,
          categories: categories.map((c) => c.category),
        },
        parent_event_id: event.event_id,
        required_tags: event.required_tags,
        risk_level: event.risk_level,
        budget: event.budget,
        status: "CLOSED",
      }),
    );

    // Publish individual sub-task TASK_POSTED events
    for (const cat of categories) {
      await this.bus.publish(
        createSwarmEvent({
          event_id: crypto.randomUUID(),
          topic: "TASK_POSTED",
          intent: `[Sub-task: ${cat.category}] ${event.intent}`,
          required_tags: cat.tags,
          risk_level: event.risk_level,
          budget: event.budget,
          parent_event_id: event.event_id,
        }),
      );
    }
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.processedEvents.clear();
  }
}
