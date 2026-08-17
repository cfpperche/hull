# Action feedback

**Every write the operator starts must confirm. A button that returns to idle with
no change is a bug.**

Read this before adding any form, button or mutation. It is normative, not advice.

| Action | Confirmation |
|---|---|
| Settings save, photo upload, non-destructive write that stays on the page | Short toast (`toast.success`). Button pending while in flight. |
| Field / schema validation | Inline next to the field. Do not toast schema errors. |
| Unexpected API failure on a form | Inline on the form. Toast only if the error would be off-screen. |
| Create that navigates to the new object | The destination is the confirmation. |
| Destructive / irreversible | Dialog **before**. After success: navigate or toast. |
| Immediate toggle / checkbox | The control state is the confirmation. |
| Long job | Progress toast / run card. |

**Refuse:** persistent "Saved." banners, success splash pages, a confirm dialog for
an ordinary Save, empty clicks.

**Copy:** verb + object, past tense, short. `Profile saved`. Not `Success!`

## What the failure looks like in practice

The 2026-08-16 review found six writes breaking this. None looked broken in code
review; all of them were found by using the app. The patterns worth recognising:

- **The error state that renders nowhere.** A failed org switch called `setError`,
  but the only render site for `error` was inside a branch that was not mounted.
  The catch ran, the state was set, and the operator saw nothing. If you write to
  error state, open the component and find where it renders.
- **The confirmation that outlives the write.** "Profile saved" fired for a request
  the server discarded, because `COALESCE` dropped an empty value. A toast asserts
  a fact; check the response says what the toast says.
- **The unhandled rejection behind `void`.** `void api.doThing()` swallows the
  failure and the button returns to idle. Three controls did this, including the
  only exit from support impersonation.
- **The cache-buster keyed to something immutable.** "Photo updated" was true, but
  the `src` never changed, so the chrome showed the old image.

## Tools

`ConfirmDialog` from `@hull/ui` is the dialog the destructive row requires — modal,
focus-trapped, and it does not close on an outside click. Give it the object by
name: "Close ada@hull.test?", not "Are you sure?".

Toasts come from `sonner`; a surface needs `<Toaster />` mounted or `toast.error`
is itself an empty click.

Pending state is a `disabled` prop plus a label change (`Saving…`), not a spinner
that leaves the control clickable.

## Judging it

You cannot review this from a diff. Drive the app — `harness/visual-ux.md` — and
try the failure path, not only the happy one. Most of these defects only appear
when the request fails.
