// ──────────────────────────────────────────────
// AgentsMdLoader: parse AGENTS.md → ProjectConfig
// ──────────────────────────────────────────────

import { readFile } from "node:fs/promises";

/**
 * Project-level configuration extracted from the root `AGENTS.md` file.
 *
 * Sections parsed:
 *   ## Project goal              — single paragraph
 *   ## How to run                — bullet list of shell commands
 *   ## Tests                     — bullet list of test commands
 *   ## Architecture constraints  — bullet list
 *   ## Coding conventions        — bullet list
 */
export interface ProjectConfig {
  goal: string;
  run_commands: string[];
  test_commands: string[];
  constraints: string[];
  conventions: string[];
}

/**
 * Parses the project-level AGENTS.md that describes the repo's
 * build commands, constraints, and coding conventions.
 */
export class AgentsMdLoader {
  async parse(filePath: string): Promise<ProjectConfig> {
    const raw = await readFile(filePath, "utf-8");
    const sections = this.splitSections(raw);

    return {
      goal: this.extractParagraph(sections["project goal"]),
      run_commands: this.extractBullets(sections["how to run"]),
      test_commands: this.extractBullets(sections["tests"]),
      constraints: this.extractBullets(sections["architecture constraints"]),
      conventions: this.extractBullets(sections["coding conventions"]),
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
