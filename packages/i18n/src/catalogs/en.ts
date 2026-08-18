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
  "mail.welcome.confirm":
    "Confirm this is your address so we can reach you about the account.",

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
  "mail.reset.ignore":
    "If you did not ask for it, nothing has changed and you can ignore this.",

  "mail.changeConfirm.subject": "Confirm your new {brand} email",
  "mail.changeConfirm.title": "Confirm your new email",
  "mail.changeConfirm.preview":
    "Until this is used, {oldEmail} is still the address on the account.",
  "mail.changeConfirm.lead":
    "Confirm this address so {brand} can move {oldEmail} to it.",
  "mail.changeConfirm.button": "Confirm this address",
  "mail.changeConfirm.expiry":
    "The link works once and expires in {hours} hours. Until then {oldEmail} is still the address on the account.",

  "mail.changeNotice.subject": "Your {brand} email is being changed",
  "mail.changeNotice.title": "Your email is being changed",
  "mail.changeNotice.preview":
    "Nothing has changed yet. {oldEmail} still signs in.",
  "mail.changeNotice.lead":
    "Someone asked to change this account's email to {newEmail}.",
  "mail.changeNotice.body":
    "Nothing has changed yet — {oldEmail} still signs in, and the change only happens if the new address confirms it.",
  "mail.changeNotice.warn":
    "If this was not you, change your password now. That cancels the request and ends every other session.",

  "mail.changed.subject": "Your {brand} email was changed",
  "mail.changed.title": "Your email was changed",
  "mail.changed.preview": "This account now signs in as {newEmail}.",
  "mail.changed.lead": "This account now signs in as {newEmail}.",
  "mail.changed.body":
    "{oldEmail} no longer reaches it, including for password reset.",
  "mail.changed.warn":
    "If this was not you, contact support — you cannot undo it from here any more.",
  // ---- The shell ---------------------------------------------------------

  "app.loading": "Loading…",
  "app.configMissing": "config.json missing — run scripts/render-brand.sh",
  "app.broke": "Something broke",
  "nav.open": "Open menu",
  "nav.close": "Close menu",
  "dialog.cancel": "Cancel",

  // ---- Account -----------------------------------------------------------

  "account.title": "Account",
  "account.description": "This login. Theme is this browser only.",
  "account.operatorDescription":
    "This operator's login. Theme is this browser only.",

  "account.photo.label": "Photo",
  "account.photo.upload": "Upload photo",
  "account.photo.uploading": "Uploading…",
  "account.photo.updated": "Photo updated",
  "account.photo.wrongType": "Photo must be a JPEG, PNG, or WebP.",
  "account.photo.tooBig": "Photo must be 5 MB or smaller.",
  "account.name": "Name",
  "account.username": "Username",
  "account.save": "Save profile",
  "account.saving": "Saving…",
  "account.saved": "Profile saved",

  "account.email.title": "Email",
  "account.email.blurb":
    "You sign in with {email}, and it is where a password reset is sent.",
  "account.email.sent":
    "Check {newEmail} for a link. Nothing has changed yet — {email} keeps working until that link is used.",
  "account.email.new": "New email",
  "account.email.password": "Password",
  "account.email.submit": "Change email",
  "account.email.sending": "Sending…",

  "account.password.title": "Password",
  "account.password.current": "Current",
  "account.password.new": "New",
  "account.password.submit": "Update password",
  "account.password.pending": "Updating…",
  "account.password.updated": "Password updated",

  "account.language.title": "Language",
  "account.appearance.title": "Appearance",
  "theme.light": "Light",
  "theme.system": "System",
  "theme.dark": "Dark",
  "theme.hint": "This browser. Default follows the device.",

  "account.close.title": "Close account",
  "account.close.blurb": "Deletes this login and workspaces only you own.",
  "account.close.password": "Password",
  "account.close.confirmTitle": "Close this account?",
  "account.close.confirmBody":
    "This deletes {email} and every workspace you are the only owner of. Workspaces with other members are kept. It cannot be undone.",
  "account.close.pending": "Closing…",

  // ---- Sessions ----------------------------------------------------------

  "sessions.title": "Where you are signed in",
  "sessions.blurb":
    "Signing in on another device does not end this one. End anything you do not recognise.",
  "sessions.support": " · support",
  "sessions.device": "{browser} on {system}",
  "sessions.unknownDevice": "Unknown device",
  "sessions.thisDevice": "This device",
  "sessions.lastUsed": "Last used {ago}",
  "sessions.justNow": "just now",
  "sessions.end": "End",
  "sessions.ending": "Ending…",
  "sessions.ended": "Session ended",
  "sessions.revokeOthers": "Sign out everywhere else",
  "sessions.revokeOthers.done": "Signed out everywhere else",
  "sessions.revokeOthers.confirmTitle": "Sign out everywhere else?",
  "sessions.revokeOthers.confirmBody.one":
    "This ends {n} other session. This device stays signed in. Anyone using that device will have to sign in again.",
  "sessions.revokeOthers.confirmBody.other":
    "This ends {n} other sessions. This device stays signed in. Anyone using those devices will have to sign in again.",

  // ---- Auth --------------------------------------------------------------

  "auth.signIn": "Sign in",
  "auth.signIn.description": "Email and password.",
  "auth.signIn.pending": "Signing in…",
  "auth.signOut": "Sign out",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordAgain": "Repeat the password",
  // One key, three screens. Signup, reset and change-password all ask twice
  // and all fail the same way; three spellings of one sentence is how a
  // catalog starts disagreeing with itself.
  "auth.passwordMismatch": "Those two passwords are different.",
  "auth.noAccount": "No account?",
  "auth.createOne": "Create one",
  "auth.haveAccount": "Already have an account?",
  "auth.forgot": "Forgot?",
  "auth.backToSignIn": "Back to sign in",
  "auth.goToSignIn": "Go to sign in",

  "signup.title": "Create account",
  "signup.description": "An email and a password. Nothing else.",
  "signup.submit": "Create account",
  "signup.pending": "Creating…",
  "signup.invalid": "An email address, and a password of at least 8 characters.",

  "forgot.title": "Reset your password",
  "forgot.description": "We'll email you a link.",
  "forgot.submit": "Send the link",
  "forgot.pending": "Sending…",
  "forgot.sentTitle": "Check your email",
  "forgot.sentDescription":
    "If that address has an account, a reset link is on its way.",
  "forgot.sentBody":
    "The link works once and expires in 30 minutes. Nothing has changed until you use it.",

  "reset.title": "Choose a new password",
  "reset.description":
    "At least 8 characters. This ends every signed-in session.",
  "reset.password": "New password",
  "reset.confirm": "Repeat it",
  "reset.submit": "Set the password",
  "reset.pending": "Saving…",
  "reset.done": "Password changed",
  "reset.noTokenTitle": "That link is incomplete",
  "reset.noTokenDescription": "Reset links carry a token. Ask for a new one.",
  "reset.newLink": "Send a new link",

  "verify.working": "Confirming…",
  "verify.doneTitle": "Email confirmed",
  "verify.doneDescription": "That address is now the one we use to reach you.",
  "verify.failedTitle": "Could not confirm that address",
  "verify.failedDescription":
    "Confirmation links are single use and expire after three days.",
  "verify.noToken":
    "This link has no token. Ask for a new one from your account.",
  "verify.banner": "Confirm {email} — check your inbox.",
  "verify.resend": "Send again",
  "verify.resending": "Sending…",
  "verify.resent": "Confirmation sent",

  "emailChange.doneTitle": "Email changed",
  "emailChange.doneDescription":
    "This is the address you sign in with now, and the one that resets your password.",
  "emailChange.failedTitle": "Could not change that address",
  "emailChange.failedDescription":
    "These links are single use and expire after two hours. Changing your password cancels them.",

  "handoff.working": "Opening workspace…",
  "handoff.failedTitle": "Could not open that workspace",
  "handoff.failedDescription":
    "Hand-off links are single use and expire after a minute.",
  "handoff.noToken":
    "This link has no hand-off token. Start again from the admin console.",

  "common.continue": "Continue",

  // ---- Workspaces --------------------------------------------------------

  "org.createTitle": "One more step",
  "org.createDescription": "A name for you, and a name for your workspace.",
  "org.yourNameHint": "Optional — it is how the product will address you.",
  "org.name": "Workspace name",
  "org.creating": "Creating…",
  "org.fallback": "Workspace",
  "org.switching": "Switching…",
  "org.new": "New workspace",
  "org.add": "Add",
  "org.adding": "Adding…",
  "org.created": "Workspace created",

  "home.title": "Home",
  "home.empty": "Nothing in this workspace yet.",
  "notFound.title": "Not found",
  "notFound.back": "Back home",

  "support.viewingAs": "Viewing as {org}",
  "support.stop": "Stop",
  "support.stopping": "Stopping…",

  // ---- The console -------------------------------------------------------

  "admin.title": "Admin",
  "admin.signIn.description": "Platform operators only.",
  "admin.redirecting": "Redirecting…",
  "admin.operator": "Operator",
  "admin.nav.overview": "Overview",
  "admin.nav.users": "Users",
  "admin.nav.orgs": "Workspaces",
  "admin.nav.lab": "Lab",
  "admin.nav.mail": "Mail",
  "admin.nav.objects": "Objects",
  "admin.nav.db": "Database",

  "admin.overview.title": "Overview",
  "admin.overview.description": "This install.",

  "admin.users.title": "Users",
  "admin.users.description": "Every login on this install.",
  "admin.users.error": "Could not load users.",
  "admin.users.email": "Email",
  "admin.users.username": "Username",
  "admin.users.role": "Role",
  "admin.users.roleAdmin": "Admin",
  "admin.users.roleMember": "Member",

  "admin.orgs.title": "Workspaces",
  "admin.orgs.description":
    "Support views a workspace without taking the owner's session.",
  "admin.orgs.error": "Could not load workspaces.",
  "admin.orgs.name": "Name",
  "admin.orgs.viewAs": "View as",
  "admin.orgs.opening": "Opening…",
  "admin.notFound.back": "Back to overview",

  // ---- The marketing site ------------------------------------------------

  "www.nav.product": "Product",
  "www.nav.surfaces": "Surfaces",
  "www.getStarted": "Get started",
  "www.eyebrow": "Standalone scaffold",
  "www.headline": "App shell and chrome. No business attached.",
  "www.sub":
    "Clone, run the setup script, Docker does the rest. Signup is username, email, and password. Then one workspace name.",
  "www.seeSurfaces": "See surfaces",
  "www.edge.title": "Own edge",
  "www.edge.body":
    "Traefik, certificates, and hosts live in this repo. Nothing on the machine except Docker.",
  "www.userOrg.title": "User + org",
  "www.userOrg.body":
    "One login, many workspaces. Isolation is org_id. Support views an org without stealing the session.",
  "www.module.title": "Module slot",
  "www.module.body":
    "The home page is empty on purpose. A product module fills it. The hull does not know what you sell.",
  "www.surfaces.title": "Three hosts",
  "www.surfaces.www": "This page. No cookie.",
  "www.surfaces.app": "Product shell.",
  "www.surfaces.admin": "Install operators.",
  "www.open": "Open",

  // ---- What the server says went wrong -----------------------------------
  //
  // The API answers with a code, not a sentence: `reason_code` is the class the
  // client branches on and is far too coarse to key a message — `unauthenticated`
  // alone covers six of these. The English `detail` is still sent, as the log
  // line and as the fallback for a client that has not learned a key yet.

  "error.emailTaken": "That email is taken.",
  "error.usernameTaken": "That username is taken.",
  "error.emailRequired": "Enter an email address.",
  "error.usernameInvalid": "Username must be 3–24 letters, numbers, or _.",
  "error.passwordTooShort": "Password must be at least 8 characters.",
  "error.nameTooLong": "That name is too long.",
  "error.orgNameRequired": "Enter a workspace name.",
  "error.sameEmail": "That is already your address.",
  "error.credentialsInvalid": "Wrong email or password.",
  "error.passwordWrong": "That password is wrong.",
  "error.currentPasswordWrong": "Your current password is wrong.",
  "error.resetInvalid": "That reset link is invalid or expired.",
  "error.verifyInvalid": "That confirmation link is invalid or expired.",
  "error.linkInvalid": "That link is invalid or expired.",
  "error.handoffInvalid": "That hand-off link is invalid or expired.",
  "error.sessionNotFound": "That session is already gone.",
  "error.orgNotFound": "That workspace no longer exists.",
  "error.adminRequired": "That needs a platform operator.",
  "error.adminCannotClose": "A platform operator cannot close their own account.",
  "error.photoType": "Photo must be a JPEG, PNG, or WebP.",
  "error.photoTooLarge": "Photo is too large.",
  "error.photoUnreadable": "That photo could not be read.",
  "error.photoNotFound": "No photo.",
  "error.storageOff": "The object store is not configured.",
  "error.unauthenticated": "Sign in again.",
  "error.notFound": "Not found.",
  "error.server": "Something went wrong on our side.",
  "error.requestFailed": "Request failed.",
  "error.rateLimited": "Too many attempts. Try again in {seconds}s.",
  "error.rateLimitedSoon": "Too many attempts. Try again shortly.",
} as const;

export type MessageKey = keyof typeof en;

/** The shape every other catalog has to fill. Missing keys and invented ones
 *  are both compile errors, which is the cheapest gate available. `check` runs
 *  the same comparison at build time for the CI that does not typecheck. */
export type Catalog = Record<MessageKey, string>;
