import { Layout } from "../Layout";

/**
 * Sent at signup when there is nothing to confirm — the defensive branch, for an
 * account that somehow arrives already verified. The ordinary path is
 * welcome-verify.tsx, which carries the link.
 */
export default function Welcome() {
  return (
    <Layout
      title="Your account is ready"
      preview="Name a workspace to continue."
      lead="Name a workspace to continue."
    >
      <></>
    </Layout>
  );
}
