---
name: clean_csv
description: Clean and normalize CSV leads; produce clean.csv + data_quality_report.md.
tags: [data, clean, csv]
risk_level: LOW
permissions:
  fs_read: PROJECT
  fs_write: PROJECT
  network: NONE
  secrets: NONE
  shell_exec: true
  external_send: false
---

## Steps
1) Validate schema, detect encoding, normalize headers
2) Drop duplicates using rules in /rules/leads_dedupe.yml
3) Output:
   - artifacts/clean.csv
   - artifacts/data_quality_report.md
4) Create EvidencePack:
   - file hash for clean.csv
   - processing logs
