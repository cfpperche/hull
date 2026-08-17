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

## The email address

The address is the login **and** the recovery route: whoever reads that mailbox
can reset the password. Everything below follows from that one fact.

**Confirmed, not assumed.** A new account is unverified until the link in its
welcome mail is redeemed. Being unverified blocks nothing — it is stated in the
chrome, not enforced at a gate. An install that walls off an unverified account
locks people out over a mail server they do not run.

**Changing it is a move, not an edit.** The current password is confirmed when
the change is asked for, because that is the step a stolen session would reach.
Nothing changes until the *new* address redeems its own link — until then the old
one still signs in and still receives reset mail. The old address is told twice:
once while it can still stop the change, and once when it is done.

**Changing the password cancels any pending change.** That is what makes "if this
was not you, change your password" advice rather than decoration.

Four token tables share one shape: `password_resets`, `email_verifications`,
`email_changes` and `support_handoffs`. Hashed at rest, single use,
claimed with `used_at IS NULL` in one statement, delivered in a URL **fragment**
so the token never reaches a server log. Copy that shape; do not invent a fifth.

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

A user can see their live sessions and end any of them —
`GET /v1/me/sessions`, `DELETE /v1/me/sessions/{id}`, and `DELETE /v1/me/sessions`
for everywhere-but-here. **No password on any of them.** Revoking only ever takes
access away, and putting a credential in front of the safe action is backwards at
the moment somebody has stopped trusting a device. Ownership is enforced inside
the delete, not checked around it, because the id is in the URL and is not a
secret. A row is recognised by its `User-Agent` — self-reported, so the label is a
hint, not evidence — and by `last_seen_at`, stamped on use at most once a minute
so an authenticated GET does not become a write.

An operator's support session appears in the operator's own list, marked as one.
It is theirs; an unexplained extra row would read like a break-in.

Changing the **email** does not end sessions, and that is deliberate. A reset is
what someone does after losing control; a change is a deliberate edit made from a
signed-in seat, and ending it would sign the person out of the laptop they
started on because they finished the job on their phone.

`app.` and `admin.` are separate sessions.
See [ADR-0009](adr/0009-host-scoped-cookie-and-support-hand-off.md).

## Account closure

Irreversible, and confirmed before it runs. It deletes the login and every Org the
user is the **sole owner** of. Orgs with other members survive; the closing user's
membership goes with them.

## Not in scope

Billing. SSO. Roles beyond `owner` / `member`. A second level above Org.

Each is a decision, not an oversight — if one changes, it changes in an ADR first.
