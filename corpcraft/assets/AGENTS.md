# AGENTS.md

## Project goal
CorpCraft OS - 3D sandbox + event-driven swarm engine for enterprise AgentOps.

## How to run
- pnpm i
- pnpm dev

## Tests
- pnpm test
- pnpm lint

## Architecture constraints
- No static workflow DAG orchestration.
- All collaboration through SwarmEvent bus + claim leases.
- High-risk actions must go through ApprovalRequired flow.
- Every event handler must be idempotent.

## Coding conventions
- TypeScript strict
- Avoid circular deps
- All IDs use crypto.randomUUID()
- Events are the single source of truth
