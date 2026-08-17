import { Button, Divider, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/** The one mail that arrives unauthenticated and hands back an account. */
export default function PasswordReset() {
  return (
    <Layout
      // Not "Choose a new password": the button says that, and a heading that
      // repeats its own button word for word reads like a rendering fault.
      title="Reset your password"
      preview={`The link works once and expires in ${V.resetMinutes} minutes.`}
    >
      <Button href={V.link}>Choose a new password</Button>
      <FallbackLink href={V.link} />
      <P muted>It expires in {V.resetMinutes} minutes and works once.</P>
      <Divider />
      <P muted>If you did not ask for it, nothing has changed and you can ignore this.</P>
    </Layout>
  );
}
