// ──────────────────────────────────────────────
// AgentEntity: Agent 核心实体
// ──────────────────────────────────────────────

export type AgentKind = "AI" | "HUMAN";

export type AgentStatus =
  | "IDLE"
  | "EVALUATING"
  | "CLAIMED"
  | "EXEC_TOOL"
  | "EXEC_SANDBOX"
  | "WAIT_HUMAN"
  | "FAILED"
  | "DONE";

export type AuraType = "CONTEXT" | "APPROVAL" | "REVIEW";

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface AgentMetrics {
  success_rate_7d: number;
  avg_cycle_sec_7d: number;
  token_cost_7d: number;
  approval_wait_sec_7d: number;
}

export interface AgentAura {
  radius: number;
  types: AuraType[];
}

export interface EquippedRef {
  id: string;
  version: string;
}

export interface ActiveSandbox {
  sandbox_id: string;
  pip_url: string;
}

export type AccessoryType = "helmet" | "scarf" | "star_badge" | "visor" | "crown" | "horns" | "ninja_mask" | "none";

// ──────────────────────────────────────────────
// AutonomyLevel — Controls agent self-governance
// 0: Fully manual — user must approve everything
// 1: Semi-auto — agent suggests, user approves (default)
// 2: Auto with notification — agent acts, user gets notified
// 3: Fully autonomous — agent acts independently
// ──────────────────────────────────────────────
export type AutonomyLevel = 0 | 1 | 2 | 3;

export interface AgentAppearance {
  avatar_url?: string;      // 2D avatar for UI panels
  color_primary: string;    // Main body color (procedural character)
  color_secondary: string;  // Cape / accent color
  accessory: AccessoryType; // Character-specific accessory
}

export interface AgentEntity {
  agent_id: string;
  name: string;
  kind: AgentKind;
  role_tags: string[];
  status: AgentStatus;

  zone_id?: string;
  position: Position3D;

  equipped_agents_md?: EquippedRef;
  equipped_agent_md?: EquippedRef;
  equipped_skills: EquippedRef[];

  aura?: AgentAura;
  metrics: AgentMetrics;

  active_sandbox?: ActiveSandbox;

  /** Visual appearance settings */
  appearance?: AgentAppearance;

  /** Current task being worked on */
  current_event_id?: string;

  /** Agent self-governance level (default: 1) */
  autonomy_level?: AutonomyLevel;
}

// ──────────────────────────────────────────────
// AgentTemplate — Available agents for recruitment
// ──────────────────────────────────────────────

export interface AgentTemplate {
  template_id: string;
  name: string;
  kind: AgentKind;
  description: string;
  role_tags: string[];
  appearance: AgentAppearance;
  default_skills: EquippedRef[];
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    template_id: "tpl-codex",
    name: "Codex",
    kind: "AI",
    description: "Full-stack code specialist. Writes, reviews, and refactors code.",
    role_tags: ["dev", "code"],
    appearance: { color_primary: "#e8e8e8", color_secondary: "#4a4a6e", accessory: "helmet" },
    default_skills: [{ id: "code_review", version: "1.0" }],
  },
  {
    template_id: "tpl-claude",
    name: "Claude",
    kind: "AI",
    description: "Report writer & strategic analyst. Excels at documentation.",
    role_tags: ["report", "writing"],
    appearance: { color_primary: "#d4a574", color_secondary: "#c0392b", accessory: "scarf" },
    default_skills: [{ id: "write_report", version: "2.0" }],
  },
  {
    template_id: "tpl-gemini",
    name: "Gemini",
    kind: "AI",
    description: "Data analysis & multimodal reasoning specialist.",
    role_tags: ["data", "analysis"],
    appearance: { color_primary: "#b36fd8", color_secondary: "#f5a623", accessory: "star_badge" },
    default_skills: [{ id: "data_analysis", version: "1.0" }],
  },
  {
    template_id: "tpl-qwen",
    name: "Qwen",
    kind: "AI",
    description: "Multilingual growth hacker. Marketing & content generation.",
    role_tags: ["growth", "marketing"],
    appearance: { color_primary: "#6366f1", color_secondary: "#818cf8", accessory: "visor" },
    default_skills: [{ id: "content_gen", version: "1.0" }],
  },
  {
    template_id: "tpl-cursor",
    name: "Cursor",
    kind: "AI",
    description: "Bug hunter & debugging specialist. Triage and fix.",
    role_tags: ["dev", "bugs"],
    appearance: { color_primary: "#6ba3c2", color_secondary: "#4a9eda", accessory: "ninja_mask" },
    default_skills: [{ id: "bug_triage", version: "1.0" }],
  },
  {
    template_id: "tpl-molty",
    name: "Molty",
    kind: "AI",
    description: "OpenClaw gateway agent. Remote execution & monitoring.",
    role_tags: ["ops", "infra"],
    appearance: { color_primary: "#ef4444", color_secondary: "#dc2626", accessory: "horns" },
    default_skills: [{ id: "remote_exec", version: "1.0" }],
  },
];

/** Helper to create a default AI agent */
export function createAgent(
  partial: Pick<AgentEntity, "agent_id" | "name" | "role_tags"> &
    Partial<AgentEntity>,
): AgentEntity {
  return {
    kind: "AI",
    status: "IDLE",
    position: { x: 0, y: 0, z: 0 },
    equipped_skills: [],
    metrics: {
      success_rate_7d: 1.0,
      avg_cycle_sec_7d: 0,
      token_cost_7d: 0,
      approval_wait_sec_7d: 0,
    },
    ...partial,
  };
}

// ──────────────────────────────────────────────
// Seed Agents — shared between gateway and frontend
// Zone positions: top row [-6,0,-3] [0,0,-3] [6,0,-3]
//                 bot row [-6,0, 3] [0,0, 3] [6,0, 3]
// ──────────────────────────────────────────────

interface SeedDef {
  agent_id: string;
  name: string;
  kind: AgentKind;
  role_tags: string[];
  zone_id: string;
  /** Offset from zone center */
  offsetX: number;
  offsetZ: number;
  equipped_skills: EquippedRef[];
  metrics: AgentMetrics;
  aura?: AgentAura;
  appearance?: AgentAppearance;
}

// TFT-style compact 2×3 grid — must match zone-config.ts
const ZONE_SIZE = 3.0;
const ZONE_GAP = 0.35;
const zp = (col: number, row: number): [number, number, number] => [
  (col - 1) * (ZONE_SIZE + ZONE_GAP),
  0,
  (row - 0.5) * (ZONE_SIZE + ZONE_GAP),
];
const ZONE_POSITIONS: Record<string, [number, number, number]> = {
  app: zp(0, 0),
  server: zp(1, 0),
  marketing: zp(2, 0),
  data: zp(0, 1),
  bugs: zp(1, 1),
  compliance: zp(2, 1),
};

const SEED_DEFS: SeedDef[] = [
  {
    agent_id: "demo-codex",
    name: "Codex",
    kind: "AI",
    role_tags: ["dev", "code"],
    zone_id: "server",
    offsetX: -0.3,
    offsetZ: 0.2,
    equipped_skills: [{ id: "code_review", version: "1.0" }],
    metrics: { success_rate_7d: 0.94, avg_cycle_sec_7d: 12, token_cost_7d: 3.2, approval_wait_sec_7d: 2 },
    appearance: { color_primary: "#e8e8e8", color_secondary: "#4a4a6e", accessory: "helmet" },
  },
  {
    agent_id: "demo-claude",
    name: "Claude",
    kind: "AI",
    role_tags: ["report", "writing"],
    zone_id: "app",
    offsetX: -0.3,
    offsetZ: 0.2,
    equipped_skills: [{ id: "write_report", version: "2.0" }],
    metrics: { success_rate_7d: 0.97, avg_cycle_sec_7d: 8, token_cost_7d: 2.1, approval_wait_sec_7d: 1 },
    appearance: { color_primary: "#d4a574", color_secondary: "#c0392b", accessory: "scarf" },
  },
  {
    agent_id: "demo-cursor",
    name: "Cursor",
    kind: "AI",
    role_tags: ["dev", "bugs"],
    zone_id: "bugs",
    offsetX: -0.3,
    offsetZ: 0.2,
    equipped_skills: [{ id: "bug_triage", version: "1.0" }],
    metrics: { success_rate_7d: 0.91, avg_cycle_sec_7d: 15, token_cost_7d: 4.0, approval_wait_sec_7d: 3 },
    appearance: { color_primary: "#6ba3c2", color_secondary: "#4a9eda", accessory: "ninja_mask" },
  },
  {
    agent_id: "demo-gemini",
    name: "Gemini",
    kind: "AI",
    role_tags: ["data", "analysis"],
    zone_id: "data",
    offsetX: -0.3,
    offsetZ: 0.2,
    equipped_skills: [{ id: "data_analysis", version: "1.0" }],
    metrics: { success_rate_7d: 0.88, avg_cycle_sec_7d: 20, token_cost_7d: 5.5, approval_wait_sec_7d: 4 },
    appearance: { color_primary: "#b36fd8", color_secondary: "#f5a623", accessory: "star_badge" },
  },
  {
    agent_id: "demo-admin",
    name: "Admin",
    kind: "HUMAN",
    role_tags: ["review", "approval"],
    zone_id: "compliance",
    offsetX: -0.3,
    offsetZ: 0.2,
    equipped_skills: [],
    metrics: { success_rate_7d: 1.0, avg_cycle_sec_7d: 5, token_cost_7d: 0, approval_wait_sec_7d: 0 },
    aura: { radius: 0.8, types: ["APPROVAL", "REVIEW"] },
    appearance: { color_primary: "#27ae60", color_secondary: "#f1c40f", accessory: "crown" },
  },
];

/** Pre-built seed agents ready to register */
export function getSeedAgents(): AgentEntity[] {
  return SEED_DEFS.map((def) => {
    const zonePos = ZONE_POSITIONS[def.zone_id] ?? [0, 0, 0];
    return createAgent({
      agent_id: def.agent_id,
      name: def.name,
      kind: def.kind,
      role_tags: def.role_tags,
      zone_id: def.zone_id,
      position: {
        x: zonePos[0] + def.offsetX,
        y: 0,
        z: zonePos[2] + def.offsetZ,
      },
      equipped_skills: def.equipped_skills,
      metrics: def.metrics,
      aura: def.aura,
      appearance: def.appearance,
    });
  });
}
