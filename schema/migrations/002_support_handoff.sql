-- Support hand-off tokens.
--
-- The session cookie is host-scoped, so admin.<host> and app.<host> no longer
-- share one. "View as" therefore cannot rely on the browser carrying the admin's
-- session across hosts: it mints a one-time token here, the admin surface passes
-- it in a URL fragment, and app.<host> exchanges it for its own session.
--
-- Stored hashed, like sessions.session_hash — the raw token only ever exists in
-- the redirect and in the exchange request.

CREATE TABLE support_handoffs (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_handoffs_expires_idx ON support_handoffs (expires_at);
