CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    username TEXT,
    display_name TEXT,
    password_hash TEXT NOT NULL,
    platform_role TEXT,
    avatar_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_uidx ON users (lower(email));
CREATE UNIQUE INDEX users_username_lower_uidx ON users (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE orgs (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE org_members (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (user_id, org_id)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    session_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    org_id UUID REFERENCES orgs (id) ON DELETE SET NULL,
    acting_org_id UUID REFERENCES orgs (id) ON DELETE SET NULL,
    acting_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE install_events (
    id UUID PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    source TEXT NOT NULL,
    event TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    org_id UUID,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX install_events_ts_idx ON install_events (ts DESC);
