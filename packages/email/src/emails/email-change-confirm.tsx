import { Button, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/** To the *new* address. Until this is redeemed, nothing about the account moves. */
export default function EmailChangeConfirm() {
  return (
    <Layout
      title="Confirm your new email"
      preview={`Until this is used, ${V.oldEmail} is still the address on the account.`}
      lead={
        <>
          Confirm this address so {V.brand} can move <strong>{V.oldEmail}</strong> to it.
        </>
      }
    >
      <Button href={V.link}>Confirm this address</Button>
      <FallbackLink href={V.link} />
      <P muted>
        The link works once and expires in {V.changeHours} hours. Until then {V.oldEmail} is still
        the address on the account.
      </P>
    </Layout>
  );
}
