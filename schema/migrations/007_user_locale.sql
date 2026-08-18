-- The language a person reads.
--
-- Until now nothing in the system could be asked this, and one thing was
-- answering it anyway: the session list formats "last used" with the browser's
-- own locale, so a Brazilian reader has been served "Last used há 4 minutos" —
-- half a sentence in each language. The fix is not more translation, it is a
-- single place the answer lives. → ADR-0016
--
-- On the user, not the org. A workspace does not read; a person does, and the
-- same person may belong to several workspaces. An org-level default is a real
-- request the day a customer makes it, and it is one column plus an argument
-- about which one wins.

-- With a default, and NOT NULL. Every existing account has been reading English,
-- so 'en' is the true value for them rather than a placeholder — and hull_test
-- is never dropped, so a nullable column here would mean every read carrying a
-- fallback forever.
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';

-- Deliberately not a CHECK constraint or an enum. The list of locales is
-- generated from packages/i18n into hull_fastapi/locales.json, and a copy of it
-- in the schema would be a third place to keep in step — one that fails at
-- migration time, in production, rather than at build time. The API validates
-- on the way in; this column stores what it was given.
