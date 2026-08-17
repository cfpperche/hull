import { Divider, Layout, P } from "../Layout";
import { V } from "../vars";

/** To the old address, after the move. The last mail it will get. No button, for
 *  the same reason as the notice. */
export default function EmailChanged() {
  return (
    <Layout
      title="Your email was changed"
      preview={`This account now signs in as ${V.newEmail}.`}
      lead={
        <>
          This account now signs in as <strong>{V.newEmail}</strong>.
        </>
      }
    >
      <P>{V.oldEmail} no longer reaches it, including for password reset.</P>
      <Divider />
      <P>
        If this was not you, contact support — you cannot undo it from here any more.
      </P>
    </Layout>
  );
}
