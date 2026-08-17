-- Email verification.
--
-- The address was collected at signup, mailed once, and never confirmed — so
-- nothing in the install knew whether it reached anybody. Password reset made
-- that matter: it hands account recovery to whatever was typed in that box.
--
-- Same token shape as password_resets and support_handoffs: hashed at rest,
-- single use, redeemed with `used_at IS NULL` in one statement.

ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

CREATE TABLE email_verifications (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- The address the link was sent to, not just the user. A verification minted
    -- before an address change must not confirm the one that replaced it.
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_verifications_expires_idx ON email_verifications (expires_at);
CREATE INDEX email_verifications_user_idx ON email_verifications (user_id);
