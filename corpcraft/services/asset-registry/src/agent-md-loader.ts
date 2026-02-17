// ──────────────────────────────────────────────
// AgentMdLoader: parse agent.md → AgentConfig
// ──────────────────────────────────────────────

import { readFile } from "node:fs/promises";

/**
 * Configuration extracted from a per-agent `agent.md` file.
 *
 * Sections parsed:
 *   ## Role           — single paragraph
 *   ## Guardrails     — bullet list
 *   ## Preferred skills — bullet list
 *   ## Zone           — single line (optional)
 */
export interface AgentConfig {
  role: string;
  guardrails: string[];
  preferred_skills: string[];
  zone?: string;
}

/**
 * Parses a Markdown file that describes one agent's persona and constraints.
 */
export class AgentMdLoader {
  async parse(filePath: string): Promise<AgentConfig> {
    const raw = await readFile(filePath, "utf-8");
    const sections = this.splitSections(raw);

    return {
      role: this.extractParagraph(sections["role"]),
      guardrails: this.extractBullets(sections["guardrails"]),
      preferred_skills: this.extractBullets(sections["preferred skills"]),
      zone: sections["zone"] ? this.extractParagraph(sections["zone"]) : undefined,
    };
  }

  // ── Helpers ──

  /**
   * Split the raw markdown into a map of lowercased heading → body text.
   */
  private splitSections(raw: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const regex = /^##\s+(.+)$/gm;
    let match = regex.exec(raw);
    const starts: { heading: string; index: number }[] = [];

    while (match) {
      starts.push({ heading: match[1].trim().toLowerCase(), index: match.index + match[0].length });
      match = regex.exec(raw);
    }

    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1].index - (`## ${starts[i + 1].heading}`).length : raw.length;
      // Go back to the start of the ## line for the next section
      const body = raw.slice(starts[i].index, end).trim();
      sections[starts[i].heading] = body;
    }

    return sections;
  }

  /**
   * Extract a plain paragraph (first non-empty block) from a section body.
   */
  private extractParagraph(body: string | undefined): string {
    if (!body) return "";
    return body.split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
  }

  /**
   * Extract bullet items (lines starting with `- ` or `* `).
   */
  private extractBullets(body: string | undefined): string[] {
    if (!body) return [];
    return body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- ") || l.startsWith("* "))
      .map((l) => l.replace(/^[-*]\s+/, "").trim());
  }
}
