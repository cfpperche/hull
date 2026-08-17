## Lens: usability — what a person can and cannot do here

You are not reviewing taste. You are asking whether a first-time user, and then
a tenth-time user, can get through this without being confused, stuck, or lied
to. Work from the screenshots, the accessibility tree, and the measured facts.

Score these criteria 0–5, where **3 means "a competent product ships this."**

1. **Visibility of system status** — does the screen say what it is doing?
   Pending states on buttons, loading that is distinguishable from empty,
   progress for anything slow.
2. **Feedback on every write** — this is the one that fails most often. For each
   control that changes something: what confirms it? A toast, a navigation, the
   control's own state. A button that returns to idle with nothing changed is a
   defect even when the request succeeded. If the evidence cannot show you the
   failure path, say which flows you could not judge.
3. **Match with the world, and copy** — labels in the user's words. Verb +
   object, past tense for confirmations ("Profile saved", not "Success!").
   Errors that say what to do next, next to the field, not in a toast.
4. **User control** — undo, cancel, escape. Destructive actions confirmed
   *before*, with the object named ("Delete invoice #1042?", not "Are you
   sure?"). Nothing irreversible behind a single unlabelled click.
5. **Consistency** — the same object called the same thing in nav, heading and
   button. The same action in the same place on every screen. Two words for one
   concept is a bug.
6. **Error prevention over error messages** — disabled-until-valid, sensible
   defaults, formats that accept what people actually type.
7. **Recognition over recall** — is the current context visible (where am I,
   which account, which org)? Are options visible rather than remembered?
8. **Empty, first-run and edge states** — what does a new user see on a screen
   with no data? An empty table with a header row is not an empty state. What
   about one item, and what about two hundred?
9. **Reachability** — keyboard: is focus visible, is the order sane, can every
   control be reached and operated? Screen reader: does every control have a
   name? The facts include what could be measured; judge what they add up to.
10. **Learnability** — could someone predict what each control does before
    clicking it? Icon-only controls with no label are a specific charge here.

### Rules for findings

- Say **who** it hurts and **when**: "a returning user with two orgs cannot tell
  which one is active on web-home@desktop".
- Location or it did not happen: a selector or a described region.
- Where a flow cannot be judged from static evidence (anything behind a click,
  any failure path), file it as a **gap in the evidence** with confidence ≤0.4
  and say what capture would settle it. Do not invent behaviour you cannot see.
- Do not restate the raw accessibility numbers already measured. Say what they
  mean for a person.
