import { Button, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/**
 * Signup. One mail, not two — a welcome and a separate "confirm your address"
 * arriving together is the pair people learn to ignore, and the link is the only
 * part of either that does anything.
 */
export default function WelcomeVerify() {
  return (
    <Layout
      title="Your account is ready"
      preview="Name a workspace to continue."
      lead="Name a workspace to continue."
    >
      <P>Confirm this is your address so we can reach you about the account.</P>
      <Button href={V.link}>Confirm email</Button>
      <FallbackLink href={V.link} />
      <P muted>The link works once and expires in {V.verifyDays} days.</P>
    </Layout>
  );
}
