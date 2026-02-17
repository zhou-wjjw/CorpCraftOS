// ──────────────────────────────────────────────
// Intel Pipeline 契约 (V2 预埋 — Sprint 4 实现)
// ──────────────────────────────────────────────

export type IntelSourceType = "SEARCH" | "CRAWLER" | "ORACLE" | "MANUAL";

export interface IntelSource {
  source_id: string;
  type: IntelSourceType;
  name: string;
  config: Record<string, unknown>;
  credibility: number; // 0..1
  last_fetch_at?: number;
}

export type IntelCategory =
  | "OPPORTUNITY"
  | "THREAT"
  | "COMPETITOR_MOVE"
  | "REGULATORY"
  | "TECH_SHIFT";

export interface IntelReport {
  report_id: string;
  sources: Array<{
    source_id: string;
    fetched_at: number;
    credibility: number;
  }>;
  subject: string;
  category: IntelCategory;
  summary: string;
  structured_data?: Record<string, unknown>;
  evidence_pack_id?: string;
  fog_markers: FogMarker[];
  created_at: number;
}

export type FogMarkerType =
  | "GOLD_VEIN"
  | "RED_STORM"
  | "ENEMY_ARROW"
  | "NEUTRAL_INFO";

export interface FogMarker {
  marker_id: string;
  type: FogMarkerType;
  label: string;
  position: { x: number; y: number };
  intensity: number; // 0..1
  intel_report_id: string;
  expires_at?: number;
}
