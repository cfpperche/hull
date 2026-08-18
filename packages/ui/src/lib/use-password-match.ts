import { useCallback, useEffect, useState } from "react";
import { useT } from "../components/LocaleProvider";

/**
 * How long typing has to stop before the two boxes are called different.
 *
 * Exported because the browser specs need it: a test that waits an arbitrary
 * amount is a test that becomes flaky the day this number moves.
 */
export const MATCH_DELAY_MS = 500;

export type PasswordMatch = {
  /** The message to render under the second box, or null. Debounced. */
  message: string | null;
  /** The truth, right now, with no delay. What the submit guard reads. */
  ok: boolean;
  /** Say it immediately — for submit, which cannot wait out the debounce. */
  reveal: () => void;
};

/**
 * "These two are different", said at the right moment.
 *
 * The naive version compares on every keystroke and is worse than no check at
 * all: the second box differs from the first from its very first character, so
 * the form calls the person wrong while they are still answering it. Waiting for
 * a pause is what makes the message information rather than noise.
 *
 * **The delay is asymmetric on purpose.** Complaining waits; withdrawing the
 * complaint does not. Once somebody has fixed it, holding the red text for
 * another half second reads as the form not noticing — and that is the moment
 * they are looking for reassurance, not the moment to make them wait for it.
 *
 * The submit guard reads `ok`, never `message`. Someone who types two different
 * passwords and hits the button inside the debounce window must still be
 * refused, and the message they then see comes from `reveal`.
 */
export function usePasswordMatch(
  password: string,
  confirm: string,
  delay = MATCH_DELAY_MS,
): PasswordMatch {
  const t = useT();
  const [shown, setShown] = useState(false);
  // Nothing typed in the second box is not a mismatch, it is an unanswered
  // question. Comparing an empty box would put an error on a form nobody has
  // finished filling in.
  const differ = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    if (!differ) {
      setShown(false);
      return;
    }
    const id = setTimeout(() => setShown(true), delay);
    // password and confirm are dependencies as well as `differ`: while both keep
    // changing and both keep differing, each keystroke has to restart the wait,
    // and `differ` alone stays true without re-firing.
    return () => clearTimeout(id);
  }, [differ, password, confirm, delay]);

  const reveal = useCallback(() => setShown(true), []);

  return {
    message: differ && shown ? t("auth.passwordMismatch") : null,
    ok: !differ,
    reveal,
  };
}
