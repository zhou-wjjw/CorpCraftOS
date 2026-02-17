// ──────────────────────────────────────────────
// Zone Config — Single Source of Truth  (V2 — Territory Layout)
// ALL zone positions, agent defaults, board/anvil positions
// Every file must import from here. Never hardcode zone coords.
// 48 enterprise management zones in 6 irregular territory clusters
// ──────────────────────────────────────────────

export interface ZoneDef {
  id: string;
  label: string;
  position: [number, number, number];
  color: string;
  /** Grid coordinates (virtual 12×10 grid) */
  col: number;
  row: number;
  /** The job role / position title for this zone */
  role: string;
  /** Max agents that can work here simultaneously */
  capacity: number;
  /** Whether this zone is active (lit up) at game start */
  initiallyActive: boolean;
  /** Offset from zone center for the prop model */
  propOffset: [number, number, number];
  /** Offset from zone center for the anvil workbench */
  anvilOffset: [number, number, number];
  /** Model type for the zone prop */
  propModel: string;
  /** Color for the zone prop */
  propColor: string;
}

// ── Layout Constants ──

export const ZONE_SIZE = 4.6;
export const ZONE_GAP = 0.35;

/** Internal virtual grid center — used only by zonePos(). */
const GRID_CENTER_COL = 5.5; // (12-1)/2
const GRID_CENTER_ROW = 4.5; // (10-1)/2

/** Compute zone center for a given (col, row) in the virtual 12×10 grid */
function zonePos(col: number, row: number): [number, number, number] {
  const x = (col - GRID_CENTER_COL) * (ZONE_SIZE + ZONE_GAP);
  const z = (row - GRID_CENTER_ROW) * (ZONE_SIZE + ZONE_GAP);
  return [x, 0, z];
}

const P: [number, number, number] = [-1.2, 0, -1.0];
const A: [number, number, number] = [1.2, 0, 0.6];

// ── All 48 Zone Definitions (6 territory clusters on virtual 12×10 grid) ──
//
// Layout (R=R&D, M=Marketing, C=Core, O=Ops, F=Finance, P=People, .=empty):
//
//      Col: 0  1  2  3  4  5  6  7  8  9  10 11
// Row 0:    .  .  .  R  R  R  .  .  .  .  .  .
// Row 1:    .  .  R  R  R  R  R  .  .  .  .  .
// Row 2:    .  .  .  .  .  .  .  .  .  .  .  .       ← corridor
// Row 3:    M  M  M  .  C  C  C  .  .  O  O  O
// Row 4:    M  M  M  .  C  C  C  C  .  O  O  O
// Row 5:    .  M  M  .  .  C  .  .  .  O  O  .
// Row 6:    .  .  .  .  .  .  .  .  .  .  .  .       ← corridor
// Row 7:    .  F  F  F  .  .  .  P  P  P  .  .
// Row 8:    .  F  F  F  F  .  .  P  P  P  P  .
// Row 9:    .  .  F  .  .  .  .  .  P  .  .  .
//
// * = initiallyActive (Core group)

export const ZONES: ZoneDef[] = [
  // ── R&D Territory (top center, L-shape) ──
  { id: "product",      label: "Product",      col: 3, row: 0, position: zonePos(3, 0), color: "#34d399", role: "Product Manager",   capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#50e0a8" },
  { id: "engineering",  label: "Engineering",  col: 4, row: 0, position: zonePos(4, 0), color: "#38bdf8", role: "Tech Lead",          capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#50c8f0" },
  { id: "frontend",     label: "Frontend",     col: 5, row: 0, position: zonePos(5, 0), color: "#60a5fa", role: "Frontend Dev",       capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#78b8f0" },
  { id: "backend",      label: "Backend",      col: 2, row: 1, position: zonePos(2, 1), color: "#818cf8", role: "Backend Dev",        capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#9098f0" },
  { id: "mobile",       label: "Mobile",       col: 3, row: 1, position: zonePos(3, 1), color: "#86efac", role: "Mobile Dev",         capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#98f0b8" },
  { id: "architecture", label: "Architecture", col: 4, row: 1, position: zonePos(4, 1), color: "#c084fc", role: "Architect",          capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#c898f0" },
  { id: "devops",       label: "DevOps",       col: 5, row: 1, position: zonePos(5, 1), color: "#5eead4", role: "DevOps Engineer",    capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#68e0c8" },
  { id: "qa",           label: "QA",           col: 6, row: 1, position: zonePos(6, 1), color: "#fca5a5", role: "QA Engineer",        capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "bug",       propColor: "#f0a0a0" },

  // ── Marketing Territory (left, compact block) ──
  { id: "mkt_ops",      label: "Mkt Ops",      col: 0, row: 3, position: zonePos(0, 3), color: "#f472b6", role: "Marketing Ops",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#f490b8" },
  { id: "sales",        label: "Sales",        col: 1, row: 3, position: zonePos(1, 3), color: "#fca5a5", role: "Sales Rep",          capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#f0a0a0" },
  { id: "growth",       label: "Growth",       col: 2, row: 3, position: zonePos(2, 3), color: "#a3e635", role: "Growth Hacker",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#b0e848" },
  { id: "bd",           label: "BD",           col: 0, row: 4, position: zonePos(0, 4), color: "#fdba74", role: "BD Manager",         capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#f0c080" },
  { id: "branding",     label: "Branding",     col: 1, row: 4, position: zonePos(1, 4), color: "#f0abfc", role: "Brand Designer",     capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#e8b0f0" },
  { id: "content",      label: "Content",      col: 2, row: 4, position: zonePos(2, 4), color: "#fb923c", role: "Content Creator",    capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#f0a060" },
  { id: "pr",           label: "PR",           col: 1, row: 5, position: zonePos(1, 5), color: "#e879f9", role: "PR Specialist",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#e090f0" },
  { id: "community",    label: "Community",    col: 2, row: 5, position: zonePos(2, 5), color: "#67e8f9", role: "Community Mgr",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#78e0f0" },

  // ── Core Territory (center, L-shape — 6 initially active) ──
  { id: "analytics",    label: "Analytics",    col: 4, row: 3, position: zonePos(4, 3), color: "#67e8f9", role: "Data Analyst",       capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#78e0f0" },
  { id: "app",          label: "App",          col: 5, row: 3, position: zonePos(5, 3), color: "#4ade80", role: "Full-Stack Dev",     capacity: 3, initiallyActive: true,  propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#60d4a0" },
  { id: "server",       label: "Server",       col: 6, row: 3, position: zonePos(6, 3), color: "#60a5fa", role: "Backend Dev",        capacity: 3, initiallyActive: true,  propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#7ab8e0" },
  { id: "bugs",         label: "Bugs",         col: 4, row: 4, position: zonePos(4, 4), color: "#f87171", role: "Bug Triager",        capacity: 3, initiallyActive: true,  propOffset: P, anvilOffset: A, propModel: "bug",       propColor: "#e88888" },
  { id: "data",         label: "Data",         col: 5, row: 4, position: zonePos(5, 4), color: "#a78bfa", role: "Data Engineer",      capacity: 3, initiallyActive: true,  propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#b8a0e0" },
  { id: "marketing",    label: "Marketing",    col: 6, row: 4, position: zonePos(6, 4), color: "#f472b6", role: "Marketing Lead",     capacity: 3, initiallyActive: true,  propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#f490b8" },
  { id: "compliance",   label: "Compliance",   col: 7, row: 4, position: zonePos(7, 4), color: "#fbbf24", role: "Compliance Mgr",     capacity: 3, initiallyActive: true,  propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#e8c860" },
  { id: "security",     label: "Security",     col: 5, row: 5, position: zonePos(5, 5), color: "#f9a8d4", role: "Security Engineer",  capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#f0a8c8" },

  // ── Finance Territory (bottom-left, irregular) ──
  { id: "finance",      label: "Finance",      col: 1, row: 7, position: zonePos(1, 7), color: "#22d3ee", role: "Finance Director",   capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#40e0d0" },
  { id: "accounting",   label: "Accounting",   col: 2, row: 7, position: zonePos(2, 7), color: "#fde68a", role: "Accountant",         capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#f0e090" },
  { id: "legal",        label: "Legal",        col: 3, row: 7, position: zonePos(3, 7), color: "#fde68a", role: "Legal Counsel",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#f0e090" },
  { id: "tax",          label: "Tax",          col: 1, row: 8, position: zonePos(1, 8), color: "#fdba74", role: "Tax Specialist",     capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#f0c080" },
  { id: "procurement",  label: "Procurement",  col: 2, row: 8, position: zonePos(2, 8), color: "#6ee7b7", role: "Procurement Mgr",    capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#80e8c0" },
  { id: "audit",        label: "Audit",        col: 3, row: 8, position: zonePos(3, 8), color: "#d8b4fe", role: "Auditor",            capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#d8c0f0" },
  { id: "treasury",     label: "Treasury",     col: 4, row: 8, position: zonePos(4, 8), color: "#7dd3fc", role: "Treasury Analyst",   capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#90d8f0" },
  { id: "risk",         label: "Risk",         col: 2, row: 9, position: zonePos(2, 9), color: "#fda4af", role: "Risk Analyst",       capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#f0a8b0" },

  // ── People Territory (bottom-right, irregular) ──
  { id: "hr",           label: "HR",           col: 7,  row: 7, position: zonePos(7, 7),  color: "#fb923c", role: "HR Manager",        capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#f0a060" },
  { id: "recruiting",   label: "Recruiting",   col: 8,  row: 7, position: zonePos(8, 7),  color: "#f9a8d4", role: "Recruiter",         capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#f0a8c8" },
  { id: "training",     label: "Training",     col: 9,  row: 7, position: zonePos(9, 7),  color: "#bef264", role: "Training Lead",     capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#c0f068" },
  { id: "culture",      label: "Culture",      col: 7,  row: 8, position: zonePos(7, 8),  color: "#e879f9", role: "Culture Lead",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#e090f0" },
  { id: "performance",  label: "Performance",  col: 8,  row: 8, position: zonePos(8, 8),  color: "#34d399", role: "Performance Mgr",   capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#50e0a8" },
  { id: "workplace",    label: "Workplace",    col: 9,  row: 8, position: zonePos(9, 8),  color: "#93c5fd", role: "Workplace Ops",     capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#a0c8f0" },
  { id: "learning",     label: "L&D",          col: 10, row: 8, position: zonePos(10, 8), color: "#38bdf8", role: "L&D Specialist",    capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "files",     propColor: "#50c8f0" },
  { id: "diversity",    label: "Diversity",    col: 8,  row: 9, position: zonePos(8, 9),  color: "#c4b5fd", role: "DEI Lead",          capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#c8b8f0" },

  // ── Ops/Innovation Territory (right, compact block) ──
  { id: "custsuccess",  label: "CustSuccess",  col: 9,  row: 3, position: zonePos(9, 3),  color: "#fda4af", role: "Success Manager",   capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#f0a8b0" },
  { id: "support",      label: "Support",      col: 10, row: 3, position: zonePos(10, 3), color: "#bef264", role: "Support Lead",      capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "megaphone", propColor: "#c0f068" },
  { id: "cloud",        label: "Cloud",        col: 11, row: 3, position: zonePos(11, 3), color: "#7dd3fc", role: "Cloud Engineer",    capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#90d8f0" },
  { id: "infra",        label: "Infra",        col: 9,  row: 4, position: zonePos(9, 4),  color: "#93c5fd", role: "Infra Engineer",    capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#a0c8f0" },
  { id: "ailab",        label: "AI Lab",       col: 10, row: 4, position: zonePos(10, 4), color: "#818cf8", role: "AI Researcher",     capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "server",    propColor: "#9098f0" },
  { id: "research",     label: "Research",     col: 11, row: 4, position: zonePos(11, 4), color: "#c084fc", role: "Researcher",        capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#c898f0" },
  { id: "innovation",   label: "Innovation",   col: 9,  row: 5, position: zonePos(9, 5),  color: "#e879f9", role: "Innovation Lead",   capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "shield",    propColor: "#e090f0" },
  { id: "strategy",     label: "Strategy",     col: 10, row: 5, position: zonePos(10, 5), color: "#c4b5fd", role: "Strategist",        capacity: 3, initiallyActive: false, propOffset: P, anvilOffset: A, propModel: "chart",     propColor: "#c8b8f0" },
];

// ── Derived lookups ──

export const ZONE_MAP = new Map(ZONES.map((z) => [z.id, z]));
export const ZONE_IDS = ZONES.map((z) => z.id);
export const INITIALLY_ACTIVE_IDS = ZONES.filter((z) => z.initiallyActive).map((z) => z.id);

/** Detect which zone a world-space (x, z) position falls within */
export function detectZoneAtPosition(x: number, z: number): ZoneDef | null {
  const halfSize = ZONE_SIZE / 2;
  for (const zone of ZONES) {
    const [zx, , zz] = zone.position;
    if (
      x >= zx - halfSize && x <= zx + halfSize &&
      z >= zz - halfSize && z <= zz + halfSize
    ) {
      return zone;
    }
  }
  return null;
}

// ── Dynamic MAP_BOUNDS (computed from actual zone positions) ──

export const MAP_BOUNDS = (() => {
  const pad = ZONE_SIZE / 2 + 1;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const z of ZONES) {
    const [x, , zz] = z.position;
    minX = Math.min(minX, x - pad);
    maxX = Math.max(maxX, x + pad);
    minZ = Math.min(minZ, zz - pad);
    maxZ = Math.max(maxZ, zz + pad);
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, height: maxZ - minZ };
})();

// ── Key positions ──

export const BOUNTY_BOARD_POSITION: [number, number, number] = [0, 0, MAP_BOUNDS.minZ - 1.8];
export const GLTF_SHOWCASE_POSITION: [number, number, number] = [0, 0, MAP_BOUNDS.maxZ + 3];

export function getAnvilPosition(zoneId: string): [number, number, number] {
  const zone = ZONE_MAP.get(zoneId);
  if (!zone) return [0, 0, 0];
  return [zone.position[0] + zone.anvilOffset[0], zone.position[1] + zone.anvilOffset[1], zone.position[2] + zone.anvilOffset[2]];
}

export function getPropPosition(zoneId: string): [number, number, number] {
  const zone = ZONE_MAP.get(zoneId);
  if (!zone) return [0, 0, 0];
  return [zone.position[0] + zone.propOffset[0], zone.position[1] + zone.propOffset[1], zone.position[2] + zone.propOffset[2]];
}

// ── Function Groups (visual grouping — defines territory shapes) ──

export interface ZoneFunctionGroup {
  id: string;
  /** Chinese label shown on map */
  label: string;
  /** Short English label for legend / tooltip */
  labelEn: string;
  /** Zone IDs belonging to this group */
  zoneIds: string[];
  /** Accent color for boundary + label */
  accentColor: string;
  /** Explicit cell positions defining territory shape */
  cells: [number, number][];
  /** Optional group description */
  description?: string;
  /** Group-level base skills — default skill set for agents in this group */
  baseSkills?: { id: string; version: string }[];
}

export const ZONE_FUNCTION_GROUPS: ZoneFunctionGroup[] = [
  {
    id: "grp-rnd", label: "产品研发", labelEn: "R&D", accentColor: "#60a5fa",
    zoneIds: ["product","engineering","frontend","backend","mobile","architecture","devops","qa"],
    cells: [[3,0],[4,0],[5,0],[2,1],[3,1],[4,1],[5,1],[6,1]],
  },
  {
    id: "grp-sales", label: "市场增长", labelEn: "Marketing", accentColor: "#f472b6",
    zoneIds: ["mkt_ops","sales","growth","bd","branding","content","pr","community"],
    cells: [[0,3],[1,3],[2,3],[0,4],[1,4],[2,4],[1,5],[2,5]],
  },
  {
    id: "grp-core", label: "核心业务", labelEn: "Core Ops", accentColor: "#a78bfa",
    zoneIds: ["analytics","app","server","bugs","data","marketing","compliance","security"],
    cells: [[4,3],[5,3],[6,3],[4,4],[5,4],[6,4],[7,4],[5,5]],
  },
  {
    id: "grp-finance", label: "财务法务", labelEn: "Finance", accentColor: "#fbbf24",
    zoneIds: ["finance","accounting","legal","tax","procurement","audit","treasury","risk"],
    cells: [[1,7],[2,7],[3,7],[1,8],[2,8],[3,8],[4,8],[2,9]],
  },
  {
    id: "grp-people", label: "人力行政", labelEn: "People", accentColor: "#fb923c",
    zoneIds: ["hr","recruiting","training","culture","performance","workplace","learning","diversity"],
    cells: [[7,7],[8,7],[9,7],[7,8],[8,8],[9,8],[10,8],[8,9]],
  },
  {
    id: "grp-ops", label: "运营创新", labelEn: "Innovation", accentColor: "#5eead4",
    zoneIds: ["custsuccess","support","cloud","infra","ailab","research","innovation","strategy"],
    cells: [[9,3],[10,3],[11,3],[9,4],[10,4],[11,4],[9,5],[10,5]],
  },
];

// ── Seed agents ──

export interface SeedAgentDef {
  agent_id: string;
  name: string;
  kind: "AI" | "HUMAN";
  role_tags: string[];
  zone_id: string;
  positionOffset: { x: number; y: number; z: number };
  equipped_skills: { id: string; version: string }[];
  metrics: { success_rate_7d: number; avg_cycle_sec_7d: number; token_cost_7d: number; approval_wait_sec_7d: number };
  aura?: { radius: number; types: ("CONTEXT" | "APPROVAL" | "REVIEW")[] };
}

export const SEED_AGENTS: SeedAgentDef[] = [
  { agent_id: "demo-codex",  name: "Codex",  kind: "AI",    role_tags: ["dev", "code"],       zone_id: "server",     positionOffset: { x: -0.3, y: 0, z: 0.2 }, equipped_skills: [{ id: "code_review", version: "1.0" }],   metrics: { success_rate_7d: 0.94, avg_cycle_sec_7d: 12, token_cost_7d: 3.2, approval_wait_sec_7d: 2 } },
  { agent_id: "demo-claude", name: "Claude", kind: "AI",    role_tags: ["report", "writing"], zone_id: "app",        positionOffset: { x: -0.3, y: 0, z: 0.2 }, equipped_skills: [{ id: "write_report", version: "2.0" }],  metrics: { success_rate_7d: 0.97, avg_cycle_sec_7d: 8,  token_cost_7d: 2.1, approval_wait_sec_7d: 1 } },
  { agent_id: "demo-cursor", name: "Cursor", kind: "AI",    role_tags: ["dev", "bugs"],       zone_id: "bugs",       positionOffset: { x: -0.3, y: 0, z: 0.2 }, equipped_skills: [{ id: "bug_triage", version: "1.0" }],    metrics: { success_rate_7d: 0.91, avg_cycle_sec_7d: 15, token_cost_7d: 4.0, approval_wait_sec_7d: 3 } },
  { agent_id: "demo-gemini", name: "Gemini", kind: "AI",    role_tags: ["data", "analysis"],  zone_id: "data",       positionOffset: { x: -0.3, y: 0, z: 0.2 }, equipped_skills: [{ id: "data_analysis", version: "1.0" }], metrics: { success_rate_7d: 0.88, avg_cycle_sec_7d: 20, token_cost_7d: 5.5, approval_wait_sec_7d: 4 } },
  { agent_id: "demo-admin",  name: "Admin",  kind: "HUMAN", role_tags: ["review", "approval"],zone_id: "compliance", positionOffset: { x: -0.3, y: 0, z: 0.2 }, equipped_skills: [],                                        metrics: { success_rate_7d: 1.0,  avg_cycle_sec_7d: 5,  token_cost_7d: 0,   approval_wait_sec_7d: 0 }, aura: { radius: 0.8, types: ["APPROVAL", "REVIEW"] } },
];

export function resolveAgentPosition(agent: SeedAgentDef): { x: number; y: number; z: number } {
  const zone = ZONE_MAP.get(agent.zone_id);
  if (!zone) return { x: 0, y: 0, z: 0 };
  return { x: zone.position[0] + agent.positionOffset.x, y: 0, z: zone.position[2] + agent.positionOffset.z };
}
