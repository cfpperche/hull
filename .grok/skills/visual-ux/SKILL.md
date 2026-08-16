---
name: visual-ux
description: >
  Visual judgment and UI/UX refinement loop for Hull (www, web, admin).
  Use when the user mentions ugly UI, UI/UX, visual review, screenshot review,
  polish, design feedback, or /visual-ux. Always load this before restyling
  or claiming a web UI looks good.
---

# Visual UX — Hull

**Before any UI change:** read `harness/benchmarks.md` for the sector (www, web chrome, auth, admin, lab). Write what you copy and what you refuse.

You cannot judge look from HTML/CSS or from an accessibility snapshot. **Pixels are required.**

Drive the browser with **agent-browser**, not Playwright. This skill is the **judgment loop**.

```bash
# CLI patterns (always current):
agent-browser skills get core --full

# Capture the three surfaces:
./harness/scripts/capture-ui.sh
```

Then `read_file` every PNG under `harness/visual/current/`. A path list is not a review.

## Rubric

1. Hierarchy — primary action in 2 seconds?
2. Density — product or debugger?
3. Type — size/weight salad?
4. Contrast / chrome
5. Alignment / spacing
6. States — empty, error, confirmation after write?
7. Mobile
8. Slop — Inter+purple, glass, generic dashboard

Do not declare the UI good because typecheck passed.

## Loop

1. Capture + read (before).
2. Write the rubric.
3. Smallest change.
4. Recapture + read (after).

## Out unless asked

- Playwright MCP
- Chromatic / Storybook (HANDOFF: later, when `@hull/ui` is a catalog)
- Generating the product UI with `image_gen`
