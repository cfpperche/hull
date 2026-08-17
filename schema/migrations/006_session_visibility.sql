-- Seeing where you are signed in.
--
-- Sessions have been per-device since PR #5 and nothing surfaced them: a user
-- could not see the laptop they left at an old job, let alone end it. A list
-- needs two things the row never carried — something to recognise a device by,
-- and some sign of life, so "still signed in somewhere" is distinguishable from
-- "signed in once in March".
--
-- No IP address, deliberately. It is the other column people expect here, and it
-- costs a trusted-proxy decision (X-Forwarded-For is a header anyone can write)
-- plus a store of location data this install has no other reason to hold. If it
-- is wanted, it is one column and that decision, written down.

ALTER TABLE sessions ADD COLUMN user_agent TEXT;

-- Stamped on use, not on every request: see accounts.load_session, which only
-- writes when the value is already a minute stale. A list a human reads does not
-- need finer than that, and finer would turn every authenticated GET into a write.
ALTER TABLE sessions ADD COLUMN last_seen_at TIMESTAMPTZ;

-- Existing rows have never been stamped. created_at is the honest answer for
-- them — not now(), which would claim every old session was just used.
UPDATE sessions SET last_seen_at = created_at WHERE last_seen_at IS NULL;

ALTER TABLE sessions ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN last_seen_at SET DEFAULT now();
