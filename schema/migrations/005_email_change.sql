-- Changing the address you sign in with.
--
-- The login identifier was immutable: a typo at signup was permanent, and
-- someone who left the job that owned their address had no way out. Verification
-- is what made this safe to build — the new address has to prove itself before it
-- becomes the one that recovers the account.
--
-- Fourth table, same shape as password_resets, email_verifications and
-- support_handoffs: hashed at rest, single use, claimed with `used_at IS NULL`
-- in one statement. Copy the shape rather than inventing a fifth.

CREATE TABLE email_changes (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Where the account is going. Not enforced unique: two people may both hold
    -- a pending change to the same address, and only the first to redeem gets it
    -- — users_email_lower_uidx is what decides that, at redemption.
    new_email TEXT NOT NULL,
    -- Where it is now, captured when the change was asked for. The completion
    -- notice has to reach the address that is losing the account, and by the time
    -- the link is redeemed the users row no longer says what that was.
    old_email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_changes_expires_idx ON email_changes (expires_at);
CREATE INDEX email_changes_user_idx ON email_changes (user_id);
