// ──────────────────────────────────────────────
// DeadLetterQueue: 死信队列 (V2 新增)
// ──────────────────────────────────────────────

import type { SwarmEvent } from "@corpcraft/contracts";
import type { DeadLetterEntry } from "./types.js";

const MAX_DLQ_SIZE = 1000;

export class DeadLetterQueue {
  private entries: DeadLetterEntry[] = [];

  push(event: SwarmEvent, reason: string): void {
    this.entries.push({ event, reason, at: Date.now() });
    // Evict oldest if over limit
    if (this.entries.length > MAX_DLQ_SIZE) {
      this.entries.shift();
    }
  }

  get(limit = 100): DeadLetterEntry[] {
    return this.entries.slice(-limit);
  }

  findByEventId(eventId: string): DeadLetterEntry | undefined {
    return this.entries.find((e) => e.event.event_id === eventId);
  }

  remove(eventId: string): SwarmEvent | null {
    const idx = this.entries.findIndex((e) => e.event.event_id === eventId);
    if (idx === -1) return null;
    const [entry] = this.entries.splice(idx, 1);
    return entry.event;
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}
