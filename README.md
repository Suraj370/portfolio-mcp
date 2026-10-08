# portfolio-mcp

MCP server that edits the content of my portfolio (projects, experience, skills, contact) by committing JSON files to the portfolio repo through the GitHub API. No local checkout needed.

Every write tool previews the result first; pass `confirm: true` to commit and push.

## Setup

1. Create a fine-grained GitHub token limited to the portfolio repo with **Contents: Read and write**.
2. `npm install && npm run build`
3. Register it with an agent, e.g. Claude Code:

```
claude mcp add portfolio --scope user -e GITHUB_TOKEN=<token> -e PORTFOLIO_REPO=Suraj370/surajpanda -- node C:/Users/suraj/Desktop/projects/portfolio-mcp/dist/index.js
```

Env: `GITHUB_TOKEN` (required), `PORTFOLIO_REPO` (default `Suraj370/surajpanda`), `PORTFOLIO_BRANCH` (default `main`), `PORTFOLIO_DATA_DIR` (default `src/data`).

## Tools

`get_content`, `draft_from_repo`, `add_project`, `update_project`, `remove_project`, `move_project`, `add_experience`, `update_experience`, `remove_experience`, `add_skills`, `remove_skills`, `update_contact`
