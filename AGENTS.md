# Agent Workflow

This repository uses a file-based working memory.

Required workflow for every agent session:
- Before starting meaningful work, read [docs/agent-memory/LATEST.md](/Users/sboyuk/Desktop/retention-agent-ai/docs/agent-memory/LATEST.md).
- Then read the daily file referenced there.
- After important work, update the current daily memory file.
- Important work includes:
  - architecture or product decisions
  - UX changes
  - bug investigations
  - deploys
  - production findings
  - unresolved issues worth carrying forward
- If the date changed and no daily file exists yet, create a new one from the template in `docs/agent-memory/templates/daily-template.md`.

Memory rules:
- Keep notes short and factual.
- Prefer bullets over long prose.
- Do not store secrets.
- Record what changed, what was deployed, and what still needs attention.

Paths:
- Latest pointer: `docs/agent-memory/LATEST.md`
- Daily notes: `docs/agent-memory/daily/`
- Template: `docs/agent-memory/templates/daily-template.md`
