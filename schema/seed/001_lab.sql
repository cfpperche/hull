-- Lab users. Password for both is demodemo1 (scrypt, same hasher as the Python adapter).
-- Idempotent: skip if ada already exists.

INSERT INTO users (id, email, username, display_name, password_hash)
SELECT
    '00000000-0000-4000-8000-000000000001',
    'ada@hull.dev',
    'ada',
    'Ada',
    'scrypt$bbbd31e492c4893ad465b3b21c9c1131$d06e33672d79d2cbfc77091f4e3a9cdfe0aa49cb6de4077a029e1e343f0ac91c'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'ada@hull.dev');

INSERT INTO users (id, email, username, display_name, password_hash, platform_role)
SELECT
    '00000000-0000-4000-8000-000000000002',
    'admin@hull.dev',
    'admin',
    'Admin',
    'scrypt$bbbd31e492c4893ad465b3b21c9c1131$d06e33672d79d2cbfc77091f4e3a9cdfe0aa49cb6de4077a029e1e343f0ac91c',
    'platform_admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(email) = 'admin@hull.dev');

INSERT INTO orgs (id, name)
SELECT '00000000-0000-4000-8000-000000000010', 'Ada''s workspace'
WHERE NOT EXISTS (SELECT 1 FROM orgs WHERE id = '00000000-0000-4000-8000-000000000010');

INSERT INTO org_members (user_id, org_id, role)
SELECT
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'owner'
WHERE NOT EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = '00000000-0000-4000-8000-000000000001'
      AND org_id = '00000000-0000-4000-8000-000000000010'
);
