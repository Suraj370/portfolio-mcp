---
description: Add a GitHub repo to the portfolio as a project
argument-hint: "<github-repo-url> [featured]"
---

Add this project to my portfolio: $ARGUMENTS

1. Call `draft_from_repo` with the repo URL.
2. Write the entry following the `portfolio` skill's style rules. Treat it as featured only if I said "featured"; otherwise add it to the More list.
3. Call `add_project` WITHOUT `confirm` and show me the preview.
4. Wait for my approval, then call it again with `confirm: true` and share the commit link.
