# Domain

The objects Hull is about, and the rules that hold regardless of which adapter
implements them. Architectural decisions live in [`adr/`](adr/); this file is what
the words mean and what the product does.

## Objects

| Object | Is | Is not |
|---|---|---|
| **User** | A login. One email, one password, one optional username. | A person's role, a seat, or a member of exactly one workspace. |
| **Org** | A workspace. The unit of isolation — every scoped read and write is filtered by it. | A company, a billing account, or a folder. |
| **Install** | This compose project: one edge, one database, one set of hostnames. | A tenant. Multi-tenancy is Org, inside one Install. |

There is no level between User and Org. **Do not add Company or Store** unless a
product module needs a second level, and say so in an ADR when it does.

A User reaches an Org through a **membership** carrying a role (`owner`, `member`).
A User with no membership has no workspace and is asked to name one.

`platform_role = platform_admin` is a property of the User, not of a membership. It
grants the admin surface and support impersonation. It is not an Org role.

## Signup

Username, email, password. Then one workspace name. Nothing else is asked before
the operator sees the product.

Email is unique case-insensitively; username too, when set.

## Isolation

Isolation is `org_id`. Every scoped query filters by the org resolved from the
session — never by an id taken from the request.

Resolve it with `accounts.effective_org_id(sess)` and nothing else. See
[ADR-0010](adr/0010-effective-org-id-is-the-only-org-accessor.md).

## Support

**Support acts on an Org. It never mints the customer's session.**

A platform admin opens a customer workspace by taking a session of their **own**
that carries an acting Org. The customer's session is untouched, the operator's
identity stays visible in the chrome, and the impersonation expires on its own
after 45 minutes.

Every start and stop writes to `install_events`. An operator viewing a workspace is
a recorded act, not an invisible one.

## Sessions

Per device. Signing in somewhere else does not sign this one out.

A session ends when the user signs out, when it expires, or when the password
changes — which revokes **every** session, including the one making the request,
and issues a fresh cookie so the caller stays signed in. A stolen cookie must not
survive the action taken to revoke it.

`app.` and `admin.` are separate sessions.
See [ADR-0009](adr/0009-host-scoped-cookie-and-support-hand-off.md).

## Account closure

Irreversible, and confirmed before it runs. It deletes the login and every Org the
user is the **sole owner** of. Orgs with other members survive; the closing user's
membership goes with them.

## Not in scope

Billing. SSO. Roles beyond `owner` / `member`. A second level above Org.

Each is a decision, not an oversight — if one changes, it changes in an ADR first.
