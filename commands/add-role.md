---
description: Add a work experience entry to the portfolio
argument-hint: "<role, company, dates, details>"
---

Add this role to my portfolio experience: $ARGUMENTS

1. Call `get_content` for `experience` to match the existing format.
2. Call `add_experience` WITHOUT `confirm` and show me the preview. Ask for any missing field (type, dates, location) instead of guessing.
3. Wait for my approval, then call it again with `confirm: true` and share the commit link.
