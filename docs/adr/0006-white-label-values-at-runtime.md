# 0006. White label values at runtime

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Baking the host or brand into the SPA bundle means a white-label install needs a
rebuild, which defeats shipping one image per surface.

## Decision

White-label **values** live in `.env` (`HULL_HOST`, `HULL_BRAND`, `HULL_MARK`,
`HULL_COOKIE_NAME`). `scripts/render-brand.sh` writes `/config.json`, which the chrome
fetches at start. No `VITE_HULL_HOST` is baked.

## Consequences

Changing the apex is an `.env` edit plus a restart, not a rebuild. Anything the
frontend derives from the host - including the lab-service links - is built at runtime
from `/config.json`. `.env` is parsed the way compose parses it, by
`scripts/lib/env.sh`, so the shell view and the container view cannot disagree.
