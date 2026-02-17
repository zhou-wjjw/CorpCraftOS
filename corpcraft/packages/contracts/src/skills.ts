// ──────────────────────────────────────────────
// Skill Manifest + Security Profile
// ──────────────────────────────────────────────

export type SkillTrust =
  | "OFFICIAL"
  | "INTERNAL_SIGNED"
  | "THIRD_PARTY"
  | "UNTRUSTED";

export type FsPermission = "NONE" | "PROJECT" | "ALL";
export type NetworkPermission = "NONE" | "ALLOWLIST" | "ALL";
export type SecretsPermission = "NONE" | "SCOPED" | "ALL";

export interface SkillPermissions {
  fs_read: FsPermission;
  fs_write: FsPermission;
  network: NetworkPermission;
  secrets: SecretsPermission;
  external_send: boolean;
  shell_exec: boolean;
}

export interface SkillSecurityProfile {
  trust: SkillTrust;
  permissions: SkillPermissions;
  requires_human_approval: boolean;
  static_scan_score: number; // 0..100
  last_audit_at?: number;
}

export interface SkillManifest {
  skill_id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  entry_point?: string;
  skill_md_path: string;
  security: SkillSecurityProfile;
}

/** Default minimal-permission profile */
export const MINIMAL_PERMISSIONS: SkillPermissions = {
  fs_read: "NONE",
  fs_write: "NONE",
  network: "NONE",
  secrets: "NONE",
  external_send: false,
  shell_exec: false,
};
