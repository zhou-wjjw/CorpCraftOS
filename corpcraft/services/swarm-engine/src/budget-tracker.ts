// ──────────────────────────────────────────────
// BudgetTracker: HP / MP / AP → HUD_SYNC
// ──────────────────────────────────────────────

import type { HudState, SwarmEvent } from "@corpcraft/contracts";
import { createDefaultHud, createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";

export class BudgetTracker {
  private hud: HudState;
  private unsubscribe: Unsubscribe | null = null;
  /** Idempotency guard */
  private processedEvents = new Set<string>();

  constructor(private readonly bus: IEventBus) {
    this.hud = createDefaultHud();
  }

  // ── Lifecycle ──

  init(): void {
    this.unsubscribe = this.bus.subscribe(
      ["ARTIFACT_READY", "TASK_CLOSED", "TASK_FAILED"],
      this.handleEvent.bind(this),
    );
  }

  // ── Handler ──

  private async handleEvent(event: SwarmEvent): Promise<void> {
    // Idempotent
    if (this.processedEvents.has(event.event_id)) return;
    this.processedEvents.add(event.event_id);

    let changed = false;

    if (event.topic === "ARTIFACT_READY" && event.cost_delta) {
      // MP drain: token consumption
      this.hud.mp.current = Math.max(
        0,
        this.hud.mp.current - event.cost_delta.tokens_used,
      );
      // HP drain: cash burn (scaled ×100 for display units)
      this.hud.hp.current = Math.max(
        0,
        this.hud.hp.current - event.cost_delta.cash_used * 100,
      );
      changed = true;
    }

    if (event.topic === "TASK_CLOSED") {
      // AP boost: morale up on completion
      this.hud.ap.current = Math.min(this.hud.ap.max, this.hud.ap.current + 2);
      changed = true;
    }

    if (event.topic === "TASK_FAILED") {
      // AP drain: morale hit on failure
      this.hud.ap.current = Math.max(0, this.hud.ap.current - 5);
      changed = true;
    }

    if (changed) {
      this.hud.updated_at = Date.now();
      await this.publishHudSync();
    }
  }

  // ── HUD sync ──

  private async publishHudSync(): Promise<void> {
    await this.bus.publish(
      createSwarmEvent({
        event_id: crypto.randomUUID(),
        topic: "HUD_SYNC",
        intent: "hud_state_update",
        payload: {
          hp: { ...this.hud.hp },
          mp: { ...this.hud.mp },
          ap: { ...this.hud.ap },
        },
        status: "CLOSED",
      }),
    );
  }

  // ── Query ──

  getHudState(): HudState {
    return { ...this.hud };
  }

  shutdown(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.processedEvents.clear();
  }
}
