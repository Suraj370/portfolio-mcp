---
name: portfolio
description: Rules for editing Suraj's portfolio through the portfolio MCP tools. Use whenever adding or changing projects, experience, skills or contact info on the portfolio site.
---

Edit the portfolio only through the `portfolio` MCP tools.

- Always call a write tool without `confirm` first, show the preview, and commit (`confirm: true`) only after I approve. Edits go straight to `main` and redeploy the site.
- Project descriptions: 1 to 3 sentences, concrete, no marketing language. Say what it does and the notable technical choices.
- Featured projects need `kind` (a short subtitle), 3 to 5 `tags`, and a 3-line `snippet` of terminal-style lines in the form `action → result`. Smaller or unfinished projects go in the More list with just a description.
- Experience goes newest first. Dates look like `Apr 2025 — Jul 2025 · 4 mos`.
- Never invent facts. If the repo or my message doesn't say something, ask.
