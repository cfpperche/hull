# Example module

Empty slot. A product fills `apps/web` Home and adds API routes that key off `org_id`.

Rules:

- Read the current org from the session. Never take an org id from the client as authority.
- Do not import another module.
- Do not change auth, cookie, or chrome packages to ship a feature.
