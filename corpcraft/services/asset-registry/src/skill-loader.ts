// ──────────────────────────────────────────────
// SkillLoader: parse SKILL.md frontmatter → SkillManifest
// ──────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

import type {
  SkillManifest,
  SkillPermissions,
  SkillTrust,
  RiskLevel,
} from "@corpcraft/contracts";
import { MINIMAL_PERMISSIONS } from "@corpcraft/contracts";

/**
 * Parses a SKILL.md file (YAML frontmatter + body) and produces a
 * strongly-typed SkillManifest suitable for the AssetRegistry.
 */
export class SkillLoader {
  /**
   * Parse a single SKILL.md file into a SkillManifest.
   *
   * Expected frontmatter fields:
   *   name, description, version, tags, risk_level,
   *   fs_read, fs_write, network, secrets, external_send, shell_exec,
   *   trust (optional — defaults to INTERNAL_SIGNED)
   */
  async parse(filePath: string): Promise<SkillManifest> {
    const raw = await readFile(filePath, "utf-8");
    const { data } = matter(raw);

    const skillId = this.deriveSkillId(filePath);

    const permissions: SkillPermissions = {
      fs_read: data.fs_read ?? MINIMAL_PERMISSIONS.fs_read,
      fs_write: data.fs_write ?? MINIMAL_PERMISSIONS.fs_write,
      network: data.network ?? MINIMAL_PERMISSIONS.network,
      secrets: data.secrets ?? MINIMAL_PERMISSIONS.secrets,
      external_send: data.external_send ?? MINIMAL_PERMISSIONS.external_send,
      shell_exec: data.shell_exec ?? MINIMAL_PERMISSIONS.shell_exec,
    };

    const trust: SkillTrust = data.trust ?? "INTERNAL_SIGNED";
    const riskLevel: RiskLevel = data.risk_level ?? "LOW";

    const manifest: SkillManifest = {
      skill_id: skillId,
      name: data.name ?? skillId,
      description: data.description ?? "",
      version: data.version ?? "0.0.0",
      tags: Array.isArray(data.tags) ? data.tags : [],
      entry_point: data.entry_point,
      skill_md_path: path.resolve(filePath),
      security: {
        trust,
        permissions,
        requires_human_approval: riskLevel === "HIGH",
        static_scan_score: trust === "INTERNAL_SIGNED" || trust === "OFFICIAL" ? 100 : (data.static_scan_score ?? 0),
        last_audit_at: data.last_audit_at,
      },
    };

    return manifest;
  }

  // ── Helpers ──

  /**
   * Derive a deterministic skill_id from the file path.
   * e.g. `/skills/code-review/SKILL.md` → `code-review`
   */
  private deriveSkillId(filePath: string): string {
    const dir = path.dirname(filePath);
    return path.basename(dir).toLowerCase().replace(/\s+/g, "-");
  }
}
