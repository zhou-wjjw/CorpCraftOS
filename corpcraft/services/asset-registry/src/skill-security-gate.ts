// ──────────────────────────────────────────────
// SkillSecurityGate: trust-based allow / reject
// ──────────────────────────────────────────────

import type { SkillManifest } from "@corpcraft/contracts";

/**
 * Result returned by the security gate for a given skill manifest.
 */
export interface SecurityGateResult {
  allowed: boolean;
  reason: string;
  requires_approval: boolean;
}

/**
 * Implements the CorpCraft skill security decision table:
 *
 *   OFFICIAL          → auto-allow
 *   INTERNAL_SIGNED   → verify signature (mock: always valid) → allow
 *   THIRD_PARTY       → static_scan_score >= 80?
 *                          yes → has high-risk perms?
 *                                  yes → in allowlist? → allow / require approval
 *                                  no  → allow
 *                          no  → reject
 *   UNTRUSTED         → reject
 */
export class SkillSecurityGate {
  /** Set of skill_ids that are explicitly allowed despite high-risk permissions. */
  private readonly allowlist = new Set<string>();

  // ── Allowlist management ──

  addToAllowlist(skillId: string): void {
    this.allowlist.add(skillId);
  }

  removeFromAllowlist(skillId: string): void {
    this.allowlist.delete(skillId);
  }

  isInAllowlist(skillId: string): boolean {
    return this.allowlist.has(skillId);
  }

  // ── Core evaluation ──

  evaluate(manifest: SkillManifest): SecurityGateResult {
    const { trust, static_scan_score } = manifest.security;

    // 1. OFFICIAL — always allowed
    if (trust === "OFFICIAL") {
      return { allowed: true, reason: "Official skill — auto-allowed", requires_approval: false };
    }

    // 2. INTERNAL_SIGNED — verify signature (mock: always valid)
    if (trust === "INTERNAL_SIGNED") {
      const signatureValid = this.verifySignature(manifest);
      if (!signatureValid) {
        return { allowed: false, reason: "Internal skill — signature verification failed", requires_approval: false };
      }
      return { allowed: true, reason: "Internal skill — signature valid", requires_approval: false };
    }

    // 3. UNTRUSTED — always rejected
    if (trust === "UNTRUSTED") {
      return { allowed: false, reason: "Untrusted skill — rejected", requires_approval: false };
    }

    // 4. THIRD_PARTY — score + permission + allowlist check
    if (static_scan_score < 80) {
      return {
        allowed: false,
        reason: `Third-party skill — static scan score too low (${static_scan_score}/100, minimum 80)`,
        requires_approval: false,
      };
    }

    const hasHighRisk = this.hasHighRiskPermissions(manifest);

    if (!hasHighRisk) {
      return { allowed: true, reason: "Third-party skill — scan passed, no high-risk permissions", requires_approval: false };
    }

    // High-risk permissions — check allowlist
    if (this.allowlist.has(manifest.skill_id)) {
      return { allowed: true, reason: "Third-party skill — high-risk permissions, but in allowlist", requires_approval: false };
    }

    // Not in allowlist — require human approval
    return {
      allowed: false,
      reason: "Third-party skill — high-risk permissions, not in allowlist, requires approval",
      requires_approval: true,
    };
  }

  // ── Private helpers ──

  /**
   * Mock signature verification — always returns true for now.
   * In production this would verify a cryptographic signature.
   */
  private verifySignature(_manifest: SkillManifest): boolean {
    return true;
  }

  /**
   * A skill has "high-risk" permissions if any of:
   *   - fs_write is not NONE
   *   - network is ALL
   *   - secrets is not NONE
   *   - external_send is true
   *   - shell_exec is true
   */
  private hasHighRiskPermissions(manifest: SkillManifest): boolean {
    const p = manifest.security.permissions;
    return (
      p.fs_write !== "NONE" ||
      p.network === "ALL" ||
      p.secrets !== "NONE" ||
      p.external_send ||
      p.shell_exec
    );
  }
}
