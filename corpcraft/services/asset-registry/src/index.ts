// ──────────────────────────────────────────────
// AssetRegistry: central loader & store for all
// project assets (skills, agents, project config)
// ──────────────────────────────────────────────

import { readdir } from "node:fs/promises";
import path from "node:path";

import type { SkillManifest } from "@corpcraft/contracts";
import { createSwarmEvent } from "@corpcraft/contracts";
import type { IEventBus } from "@corpcraft/event-bus";

import { SkillLoader } from "./skill-loader.js";
import { AgentMdLoader, type AgentConfig } from "./agent-md-loader.js";
import { AgentsMdLoader, type ProjectConfig } from "./agents-md-loader.js";
import { SkillSecurityGate, type SecurityGateResult } from "./skill-security-gate.js";

/**
 * AssetRegistry — the single source of truth for all parsed project assets.
 *
 * Responsibilities:
 *   1. Scan directories for SKILL.md / agent.md / AGENTS.md files
 *   2. Parse them into typed structures
 *   3. Store them in in-memory Maps
 *   4. Gate skill installation through SkillSecurityGate
 *   5. Publish ASSET_UPDATED events on the bus
 */
export class AssetRegistry {
  private readonly bus: IEventBus;
  private readonly skillLoader = new SkillLoader();
  private readonly agentMdLoader = new AgentMdLoader();
  private readonly agentsMdLoader = new AgentsMdLoader();
  readonly securityGate = new SkillSecurityGate();

  /** skill_id → SkillManifest */
  private readonly skills = new Map<string, SkillManifest>();
  /** agent file basename → AgentConfig */
  private readonly agents = new Map<string, AgentConfig>();
  /** Parsed AGENTS.md project config (if loaded) */
  private projectConfig: ProjectConfig | null = null;

  constructor(bus: IEventBus) {
    this.bus = bus;
  }

  // ── Directory scanners ──

  /**
   * Scan `dirPath` for `SKILL.md` files (one level of subdirectories).
   * Each subfolder with a SKILL.md is treated as a skill package.
   */
  async loadSkillsFromDir(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = path.join(dirPath, entry.name, "SKILL.md");

      try {
        const manifest = await this.skillLoader.parse(skillMdPath);
        this.skills.set(manifest.skill_id, manifest);
      } catch {
        // SKILL.md not found or malformed — skip silently
      }
    }
  }

  /**
   * Scan `dirPath` for `agent.md` files (one level of subdirectories).
   */
  async loadAgentsFromDir(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentMdPath = path.join(dirPath, entry.name, "agent.md");

      try {
        const config = await this.agentMdLoader.parse(agentMdPath);
        this.agents.set(entry.name, config);
      } catch {
        // agent.md not found or malformed — skip silently
      }
    }
  }

  /**
   * Parse a project-level AGENTS.md file.
   */
  async loadProjectConfig(filePath: string): Promise<ProjectConfig> {
    this.projectConfig = await this.agentsMdLoader.parse(filePath);
    return this.projectConfig;
  }

  // ── Skill accessors ──

  getSkills(): SkillManifest[] {
    return [...this.skills.values()];
  }

  getSkill(id: string): SkillManifest | null {
    return this.skills.get(id) ?? null;
  }

  // ── Agent accessors ──

  getAgents(): Map<string, AgentConfig> {
    return new Map(this.agents);
  }

  getAgent(name: string): AgentConfig | null {
    return this.agents.get(name) ?? null;
  }

  // ── Project config accessor ──

  getProjectConfig(): ProjectConfig | null {
    return this.projectConfig;
  }

  // ── Skill installation ──

  /**
   * Run the skill manifest through the security gate, store if allowed,
   * and publish an ASSET_UPDATED event on the bus.
   */
  async installSkill(manifest: SkillManifest): Promise<SecurityGateResult> {
    const result = this.securityGate.evaluate(manifest);

    if (result.allowed) {
      this.skills.set(manifest.skill_id, manifest);

      await this.bus.publish(
        createSwarmEvent({
          event_id: `asset-updated-${manifest.skill_id}-${Date.now()}`,
          topic: "ASSET_UPDATED",
          intent: `Skill installed: ${manifest.name}`,
          payload: {
            asset_type: "skill",
            skill_id: manifest.skill_id,
            action: "install",
          },
        }),
      );
    }

    return result;
  }
}

// ── Re-exports for convenience ──

export { SkillLoader } from "./skill-loader.js";
export { AgentMdLoader, type AgentConfig } from "./agent-md-loader.js";
export { AgentsMdLoader, type ProjectConfig } from "./agents-md-loader.js";
export { SkillSecurityGate, type SecurityGateResult } from "./skill-security-gate.js";
