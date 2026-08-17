import { Divider, Layout, P } from "../Layout";
import { V } from "../vars";

/**
 * To the *old* address, while it can still act. Deliberately no button.
 *
 * This goes to somebody who may not have asked for anything, and a one-click
 * action in a "was this you?" mail teaches exactly the reflex phishing depends
 * on. It says what to do; the person navigates there themselves.
 */
export default function EmailChangeNotice() {
  return (
    <Layout
      title="Your email is being changed"
      preview={`Nothing has changed yet. ${V.oldEmail} still signs in.`}
      lead={
        <>
          Someone asked to change this account&apos;s email to <strong>{V.newEmail}</strong>.
        </>
      }
    >
      <P>
        Nothing has changed yet — {V.oldEmail} still signs in, and the change only happens if that
        address confirms it.
      </P>
      <Divider />
      <P>
        If this was not you, change your password now. That cancels the request and ends every other
        session.
      </P>
    </Layout>
  );
}
