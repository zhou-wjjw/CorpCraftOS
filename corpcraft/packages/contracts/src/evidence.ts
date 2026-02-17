// ──────────────────────────────────────────────
// EvidencePack: 证据包
// ──────────────────────────────────────────────

export type EvidenceType =
  | "URL_SNAPSHOT"
  | "FILE_HASH"
  | "SCREENSHOT"
  | "LOG"
  | "DB_REF";

export interface EvidenceItem {
  type: EvidenceType;
  uri?: string;
  sha256?: string;
  note?: string;
  created_at: number;
}

export interface Provenance {
  source: string;
  fetched_at: number;
}

export interface EvidencePack {
  pack_id: string;
  items: EvidenceItem[];
  confidence: number; // 0..1
  provenance: Provenance[];
}

/** Create a minimal evidence pack */
export function createEvidencePack(
  pack_id: string,
  items: EvidenceItem[],
  source: string,
): EvidencePack {
  return {
    pack_id,
    items,
    confidence: items.length > 0 ? 0.8 : 0,
    provenance: [{ source, fetched_at: Date.now() }],
  };
}
