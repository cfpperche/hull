-- Password reset tokens.
--
-- Same shape as support_handoffs, for the same reasons: stored hashed so the
-- raw token only ever exists in the mail and in the redemption request, and
-- redeemed with `used_at IS NULL` in one UPDATE so two clicks on the same link
-- cannot both win.
--
-- Longer-lived than a hand-off (which survives one redirect) because this one
-- has to survive a trip through a mail client.

CREATE TABLE password_resets (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX password_resets_expires_idx ON password_resets (expires_at);
CREATE INDEX password_resets_user_idx ON password_resets (user_id);
