import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Button, FallbackLink, Fill, Layout, P } from "../Layout";
import { V } from "../vars";

/** To the *new* address. Until this is redeemed, nothing about the account moves. */
export default function EmailChangeConfirm({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      title={t("mail.changeConfirm.title")}
      preview={t("mail.changeConfirm.preview", { oldEmail: V.oldEmail })}
      lead={
        <Fill
          parts={t.parts("mail.changeConfirm.lead", { brand: V.brand })}
          nodes={{ oldEmail: <strong>{V.oldEmail}</strong> }}
        />
      }
    >
      <Button href={V.link}>{t("mail.changeConfirm.button")}</Button>
      <FallbackLink t={t} href={V.link} />
      <P muted>{t("mail.changeConfirm.expiry", { hours: V.changeHours, oldEmail: V.oldEmail })}</P>
    </Layout>
  );
}
