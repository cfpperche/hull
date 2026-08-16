from __future__ import annotations

import uuid

from hull_api.accounts import hash_password
from hull_api.config import Settings
from hull_api.db import connection


def seed_demo(settings: Settings) -> None:
    password = settings.demo_password
    with connection(settings) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE lower(email) = %s", ("ada@hull.dev",))
            if cur.fetchone():
                conn.commit()
                return
            ada = str(uuid.uuid4())
            admin = str(uuid.uuid4())
            org = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO users (id, email, username, display_name, password_hash)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (ada, "ada@hull.dev", "ada", "Ada", hash_password(password)),
            )
            cur.execute(
                """
                INSERT INTO users (id, email, username, display_name, password_hash, platform_role)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (admin, "admin@hull.dev", "admin", "Admin", hash_password(password), "platform_admin"),
            )
            cur.execute("INSERT INTO orgs (id, name) VALUES (%s, %s)", (org, "Ada's workspace"))
            cur.execute(
                "INSERT INTO org_members (user_id, org_id, role) VALUES (%s, %s, %s)",
                (ada, org, "owner"),
            )
        conn.commit()
