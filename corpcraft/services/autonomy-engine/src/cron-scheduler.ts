// ──────────────────────────────────────────────
// CronScheduler — Proactive agent task generation
//
// Reads autonomy.cron configs from agent definitions and
// generates TASK_POSTED events on schedule. This enables agents
// to do work proactively without human commands.
//
// Inspired by OpenClaw's cron: session type.
// ──────────────────────────────────────────────

import type { IEventBus, Unsubscribe } from "@corpcraft/event-bus";
import { createSwarmEvent } from "@corpcraft/contracts";

// ── Cron Config ──

export interface CronJobDef {
  /** Unique job ID */
  jobId: string;
  /** Agent ID that owns this cron job */
  agentId: string;
  /** Cron expression (simplified: supports minute/hour/day fields) */
  cronExpr: string;
  /** Task intent to generate */
  intent: string;
  /** Required tags for the generated task */
  requiredTags: string[];
  /** Whether this job is active */
  enabled: boolean;
}

// ── Simplified Cron Parser ──
// Supports: "*/N" (every N), "*" (every), and specific numbers
// Format: "minute hour dayOfWeek" (3 fields)

interface ParsedCron {
  minutes: number[]; // 0-59
  hours: number[];   // 0-23
  daysOfWeek: number[]; // 0-6 (0=Sunday)
}

function expandField(field: string, min: number, max: number): number[] {
  if (field === "*") {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2), 10);
    if (Number.isNaN(step) || step < 1) return [min];
    const result: number[] = [];
    for (let i = min; i <= max; i += step) result.push(i);
    return result;
  }
  // Comma-separated values
  return field.split(",").map((v) => parseInt(v.trim(), 10)).filter((v) => !Number.isNaN(v));
}

function parseCron(expr: string): ParsedCron {
  const parts = expr.trim().split(/\s+/);
  return {
    minutes: expandField(parts[0] ?? "*", 0, 59),
    hours: expandField(parts[1] ?? "*", 0, 23),
    daysOfWeek: expandField(parts[2] ?? "*", 0, 6),
  };
}

function shouldFireNow(parsed: ParsedCron, now: Date): boolean {
  return (
    parsed.minutes.includes(now.getMinutes()) &&
    parsed.hours.includes(now.getHours()) &&
    parsed.daysOfWeek.includes(now.getDay())
  );
}

// ── CronScheduler ──

export class CronScheduler {
  private jobs = new Map<string, CronJobDef>();
  private parsedCache = new Map<string, ParsedCron>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastFired = new Map<string, number>(); // jobId → last fire timestamp

  constructor(private readonly bus: IEventBus) {}

  // ── Job Management ──

  addJob(job: CronJobDef): void {
    this.jobs.set(job.jobId, job);
    this.parsedCache.set(job.jobId, parseCron(job.cronExpr));
    console.log(
      `[CronScheduler] Added job "${job.jobId}" for agent ${job.agentId}: "${job.cronExpr}" → "${job.intent.slice(0, 50)}"`,
    );
  }

  removeJob(jobId: string): void {
    this.jobs.delete(jobId);
    this.parsedCache.delete(jobId);
    this.lastFired.delete(jobId);
  }

  getJobs(): CronJobDef[] {
    return [...this.jobs.values()];
  }

  // ── Lifecycle ──

  /** Start the scheduler. Checks every 60 seconds. */
  start(): void {
    if (this.timer) return;

    // Check immediately on start
    void this.tick();

    // Then every 60 seconds (aligned to minute boundary)
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000;
    setTimeout(() => {
      void this.tick();
      this.timer = setInterval(() => void this.tick(), 60_000);
    }, msToNextMinute);

    console.log(
      `[CronScheduler] Started with ${this.jobs.size} jobs`,
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── Core Tick ──

  private async tick(): Promise<void> {
    const now = new Date();
    const nowMinute = Math.floor(now.getTime() / 60_000);

    for (const [jobId, job] of this.jobs) {
      if (!job.enabled) continue;

      const parsed = this.parsedCache.get(jobId);
      if (!parsed) continue;

      // Prevent double-fire within the same minute
      const lastMinute = this.lastFired.get(jobId) ?? 0;
      if (lastMinute === nowMinute) continue;

      if (shouldFireNow(parsed, now)) {
        this.lastFired.set(jobId, nowMinute);
        await this.fireJob(job);
      }
    }
  }

  private async fireJob(job: CronJobDef): Promise<void> {
    const eventId = crypto.randomUUID();
    const idempotencyKey = `cron:${job.jobId}:${Math.floor(Date.now() / 60_000)}`;

    console.log(
      `[CronScheduler] Firing job "${job.jobId}" → TASK_POSTED: "${job.intent.slice(0, 60)}"`,
    );

    await this.bus.publish(
      createSwarmEvent({
        event_id: eventId,
        topic: "TASK_POSTED",
        intent: job.intent,
        required_tags: job.requiredTags,
        payload: {
          source: "cron",
          cron_job_id: job.jobId,
          agent_id: job.agentId,
        },
        idempotency_key: idempotencyKey,
        status: "OPEN",
      }),
    );
  }
}
