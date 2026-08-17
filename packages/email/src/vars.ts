/**
 * The holes the sender fills in.
 *
 * These templates are rendered once, at build time, into static HTML and text
 * that ship with the Python adapter. React is not in the request path and never
 * sees a real address — so anything that varies per message is written here as a
 * literal `{{name}}` and substituted by `hull_fastapi.mail_templates` at send.
 *
 * That split is the whole design: JSX is how the mail is *composed*, not how it
 * is *sent*. Add a name here and the adapter's registry has to learn it too, or
 * the build fails — see `src/build.tsx`.
 */
export const V = {
  /** Settings.resolved_brand() */
  brand: "{{brand}}",
  /** Settings.resolved_mark() — one letter, drawn rather than fetched. */
  mark: "{{mark}}",
  /** Settings.host, for the footer. */
  host: "{{host}}",
  /** The one action this message exists for. */
  link: "{{link}}",
  /** Whole numbers, already formatted by the adapter from the TTL constants. */
  verifyDays: "{{verify_days}}",
  resetMinutes: "{{reset_minutes}}",
  changeHours: "{{change_hours}}",
  /** Addresses, in the mails that name one. */
  oldEmail: "{{old_email}}",
  newEmail: "{{new_email}}",
} as const;
