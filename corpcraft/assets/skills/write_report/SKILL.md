---
name: write_report
description: Generate formatted business report from processed data and evidence packs.
tags: [report, writing, analysis]
risk_level: LOW
permissions:
  fs_read: PROJECT
  fs_write: PROJECT
  network: NONE
  secrets: NONE
  shell_exec: false
  external_send: false
---

## Steps
1) Read input artifacts and evidence packs
2) Analyze data for key insights
3) Generate structured report with:
   - Executive summary
   - Data provenance section (citing evidence)
   - Key findings
   - Recommendations
4) Output:
   - artifacts/report.md
5) Create EvidencePack:
   - file hash for report.md
   - generation logs
