/**
 * English. The source of truth for *which keys exist* — every other catalog is
 * typed against this one, so adding a key here is what makes the build ask the
 * translators for it.
 *
 * A key names a whole phrase. `{name}` is a hole filled at translate time.
 * In the mail keys those holes are usually filled with `{{name}}` — the *other*
 * kind of hole, the one `hull_fastapi` fills at send — because mail is rendered
 * at build time and never sees a real address. The two layers nest; they do not
 * collide. → ADR-0016
 */
export const en = {
  // ---- Mail --------------------------------------------------------------
  // Subject, preview and body all live together: they are read as one thing in
  // an inbox, and splitting them across files is how a subject ends up
  // promising something the body no longer says.

  "mail.footer": "{brand} · {host}",
  "mail.orPaste": "Or paste this into your browser:",

  "mail.welcome.subject": "Welcome to {brand}",
  "mail.welcome.title": "Your account is ready",
  "mail.welcome.preview": "Name a workspace to continue.",
  "mail.welcome.lead": "Name a workspace to continue.",
  "mail.welcome.confirm": "Confirm this is your address so we can reach you about the account.",

  "mail.verify.subject": "Confirm your {brand} email",
  "mail.verify.title": "Confirm your email",
  "mail.verify.preview": "The link works once and expires in {days} days.",
  "mail.verify.button": "Confirm email",
  "mail.verify.expiry": "The link works once and expires in {days} days.",

  "mail.reset.subject": "Reset your {brand} password",
  "mail.reset.title": "Reset your password",
  "mail.reset.preview": "The link works once and expires in {minutes} minutes.",
  "mail.reset.button": "Choose a new password",
  "mail.reset.expiry": "It expires in {minutes} minutes and works once.",
  "mail.reset.ignore": "If you did not ask for it, nothing has changed and you can ignore this.",

  "mail.changeConfirm.subject": "Confirm your new {brand} email",
  "mail.changeConfirm.title": "Confirm your new email",
  "mail.changeConfirm.preview": "Until this is used, {oldEmail} is still the address on the account.",
  "mail.changeConfirm.lead": "Confirm this address so {brand} can move {oldEmail} to it.",
  "mail.changeConfirm.button": "Confirm this address",
  "mail.changeConfirm.expiry":
    "The link works once and expires in {hours} hours. Until then {oldEmail} is still the address on the account.",

  "mail.changeNotice.subject": "Your {brand} email is being changed",
  "mail.changeNotice.title": "Your email is being changed",
  "mail.changeNotice.preview": "Nothing has changed yet. {oldEmail} still signs in.",
  "mail.changeNotice.lead": "Someone asked to change this account's email to {newEmail}.",
  "mail.changeNotice.body":
    "Nothing has changed yet — {oldEmail} still signs in, and the change only happens if the new address confirms it.",
  "mail.changeNotice.warn":
    "If this was not you, change your password now. That cancels the request and ends every other session.",

  "mail.changed.subject": "Your {brand} email was changed",
  "mail.changed.title": "Your email was changed",
  "mail.changed.preview": "This account now signs in as {newEmail}.",
  "mail.changed.lead": "This account now signs in as {newEmail}.",
  "mail.changed.body": "{oldEmail} no longer reaches it, including for password reset.",
  "mail.changed.warn":
    "If this was not you, contact support — you cannot undo it from here any more.",
} as const;

export type MessageKey = keyof typeof en;

/** The shape every other catalog has to fill. Missing keys and invented ones
 *  are both compile errors, which is the cheapest gate available. `check` runs
 *  the same comparison at build time for the CI that does not typecheck. */
export type Catalog = Record<MessageKey, string>;
