import { Button, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/** The resend, from the banner in the product. */
export default function VerifyEmail() {
  return (
    <Layout
      title="Confirm your email"
      preview={`The link works once and expires in ${V.verifyDays} days.`}
    >
      <Button href={V.link}>Confirm email</Button>
      <FallbackLink href={V.link} />
      <P muted>The link works once and expires in {V.verifyDays} days.</P>
    </Layout>
  );
}
