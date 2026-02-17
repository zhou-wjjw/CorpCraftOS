// ──────────────────────────────────────────────
// EventBusBridge: Event Bus → WebSocket broadcast
// ──────────────────────────────────────────────

import type { IEventBus } from "@corpcraft/event-bus";
import type { SwarmEngine } from "@corpcraft/swarm-engine";
import type {
  ServerMessage,
  SwarmEvent,
  EventPushMsg,
  SceneStateMsg,
  HudUpdateMsg,
} from "@corpcraft/contracts";
import { EVENT_TOPICS } from "@corpcraft/contracts";

export class EventBusBridge {
  private readonly bus: IEventBus;
  private readonly broadcastFn: (msg: ServerMessage) => void;
  private engine?: SwarmEngine;
  private seq = 0;

  private readonly sceneTimer: ReturnType<typeof setInterval>;
  private readonly hudTimer: ReturnType<typeof setInterval>;
  private readonly unsubscribe: () => void;

  constructor(bus: IEventBus, broadcast: (msg: ServerMessage) => void) {
    this.bus = bus;
    this.broadcastFn = broadcast;

    // Subscribe to ALL event topics on the bus
    this.unsubscribe = this.bus.subscribe(
      [...EVENT_TOPICS],
      async (event: SwarmEvent) => {
        this.pushEvent(event);
      },
    );

    // Periodically send SCENE_STATE with current agent positions (every 2 s)
    this.sceneTimer = setInterval(() => this.sendSceneState(), 2_000);

    // Periodically send HUD_UPDATE with HP/MP/AP bars (every 3 s)
    this.hudTimer = setInterval(() => this.sendHudUpdate(), 3_000);
  }

  /** Provide the SwarmEngine so the bridge can read agent & HUD data */
  setSwarmEngine(engine: SwarmEngine): void {
    this.engine = engine;
  }

  /** Tear down timers and event subscriptions */
  shutdown(): void {
    clearInterval(this.sceneTimer);
    clearInterval(this.hudTimer);
    this.unsubscribe();
  }

  // ── Private helpers ──

  private pushEvent(event: SwarmEvent): void {
    this.seq++;
    const msg: EventPushMsg = {
      type: "EVENT_PUSH",
      event,
      seq: this.seq,
      timestamp: Date.now(),
    };
    this.broadcastFn(msg);
  }

  private sendSceneState(): void {
    if (!this.engine) return;
    const msg: SceneStateMsg = {
      type: "SCENE_STATE",
      agents: this.engine.getAgents(),
      timestamp: Date.now(),
    };
    this.broadcastFn(msg);
  }

  private sendHudUpdate(): void {
    if (!this.engine) return;
    const msg: HudUpdateMsg = {
      type: "HUD_UPDATE",
      hud: this.engine.getHudState(),
      timestamp: Date.now(),
    };
    this.broadcastFn(msg);
  }
}
