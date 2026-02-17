// ──────────────────────────────────────────────
// WatchReactor — Event-driven auto-activation
//
// Agents subscribe to event patterns. When a matching event fires,
// the reactor automatically generates a TASK_POSTED for that agent.
//
// Example: reviewer agent watches for ARTIFACT_READY with
// artifact_type="code" and auto-triggers a code review task.
// ──────────────────────────────────────────────

import type { SwarmEvent, EventTopic } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

// ── Watch Pattern Config ──

export interface WatchPattern {
  /** Unique watch ID */
  watchId: string;
  /** Agent ID that should be activated */
  agentId: string;
  /** Event topic(s) to watch */
  topics: EventTopic[];
  /** Optional payload field filters (all must match) */
  payloadFilter?: Record<string, unknown>;
  /** Task intent template to generate (can use {{field}} placeholders) */
  intentTemplate: string;
  /** Tags for the generated task */
  requiredTags: string[];
  /** Whether this watch is active */
  enabled: boolean;
  /** Cooldown in ms between auto-activations (prevents spam) */
  cooldownMs: number;
  /** Max concurrent tasks from this watch */
  maxConcurrent: number;
}

// ── WatchReactor ──

export class WatchReactor {
  private watches = new Map<string, WatchPattern>();
  private unsubscribes: Unsubscribe[] = [];
  private lastFired = new Map<string, number>(); // watchId → last fire timestamp
  private activeCounts = new Map<string, number>(); // watchId → active task count

  constructor(private readonly bus: IEventBus) {}

  // ── Watch Management ──

  addWatch(watch: WatchPattern): void {
    this.watches.set(watch.watchId, watch);
    this.activeCounts.set(watch.watchId, 0);
    console.log(
      `[WatchReactor] Added watch "${watch.watchId}" for agent ${watch.agentId}: topics=[${watch.topics.join(",")}]`,
    );
  }

  removeWatch(watchId: string): void {
    this.watches.delete(watchId);
    this.lastFired.delete(watchId);
    this.activeCounts.delete(watchId);
  }

  getWatches(): WatchPattern[] {
    return [...this.watches.values()];
  }

  // ── Lifecycle ──

  init(): void {
    // Collect all unique topics we need to watch
    const allTopics = new Set<EventTopic>();
    for (const watch of this.watches.values()) {
      for (const topic of watch.topics) {
        allTopics.add(topic);
      }
    }

    if (allTopics.size === 0) {
      console.log("[WatchReactor] No watches registered, subscribing to all artifact/evidence topics");
      allTopics.add("ARTIFACT_READY");
      allTopics.add("EVIDENCE_READY");
      allTopics.add("TASK_CLOSED");
      allTopics.add("TASK_FAILED");
    }

    const unsub = this.bus.subscribe(
      [...allTopics],
      this.handleEvent.bind(this),
    );
    this.unsubscribes.push(unsub);

    console.log(
      `[WatchReactor] Initialized, watching ${allTopics.size} topics for ${this.watches.size} patterns`,
    );
  }

  /** Re-subscribe after adding new watches (call after addWatch if already init'd) */
  refresh(): void {
    this.shutdown();
    this.init();
  }

  shutdown(): void {
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
  }

  // ── Event Handler ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
    for (const [watchId, watch] of this.watches) {
      if (!watch.enabled) continue;
      if (!watch.topics.includes(event.topic)) continue;

      // Check payload filter
      if (watch.payloadFilter && !this.matchesFilter(event, watch.payloadFilter)) {
        continue;
      }

      // Check cooldown
      const now = Date.now();
      const lastFire = this.lastFired.get(watchId) ?? 0;
      if (now - lastFire < watch.cooldownMs) continue;

      // Check max concurrent
      const active = this.activeCounts.get(watchId) ?? 0;
      if (active >= watch.maxConcurrent) continue;

      // Don't react to our own generated tasks
      if (event.payload?.source === "watch" && event.payload?.watch_id === watchId) {
        continue;
      }

      // Fire!
      this.lastFired.set(watchId, now);
      this.activeCounts.set(watchId, active + 1);

      await this.fireWatch(watch, event);
    }
  }

  private matchesFilter(
    event: SwarmEvent,
    filter: Record<string, unknown>,
  ): boolean {
    for (const [key, expectedValue] of Object.entries(filter)) {
      const actualValue = event.payload?.[key];
      if (actualValue !== expectedValue) return false;
    }
    return true;
  }

  private async fireWatch(
    watch: WatchPattern,
    triggerEvent: SwarmEvent,
  ): Promise<void> {
    // Resolve intent template with event fields
    let intent = watch.intentTemplate;
    intent = intent.replace("{{intent}}", triggerEvent.intent);
    intent = intent.replace("{{event_id}}", triggerEvent.event_id);
    intent = intent.replace("{{topic}}", triggerEvent.topic);
    if (triggerEvent.payload) {
      for (const [key, value] of Object.entries(triggerEvent.payload)) {
        intent = intent.replace(`{{payload.${key}}}`, String(value));
      }
    }

    const eventId = crypto.randomUUID();

    console.log(
      `[WatchReactor] Watch "${watch.watchId}" triggered by ${triggerEvent.topic} → TASK_POSTED: "${intent.slice(0, 60)}"`,
    );

    await this.bus.publish(
      createSwarmEvent({
        event_id: eventId,
        topic: "TASK_POSTED",
        intent,
        required_tags: watch.requiredTags,
        payload: {
          source: "watch",
          watch_id: watch.watchId,
          agent_id: watch.agentId,
          trigger_event_id: triggerEvent.event_id,
          trigger_topic: triggerEvent.topic,
        },
        parent_event_id: triggerEvent.parent_event_id,
        status: "OPEN",
      }),
    );

    // Track task completion to decrement active count
    const unsub = this.bus.subscribe(
      ["TASK_CLOSED", "TASK_FAILED"],
      (closeEvt: SwarmEvent) => {
        if (closeEvt.payload?.original_event_id === eventId) {
          const current = this.activeCounts.get(watch.watchId) ?? 1;
          this.activeCounts.set(watch.watchId, Math.max(0, current - 1));
          unsub();
        }
      },
    );
    this.unsubscribes.push(unsub);
  }
}
