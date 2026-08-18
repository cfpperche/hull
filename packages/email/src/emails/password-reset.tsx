import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Button, Divider, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/** The one mail that arrives unauthenticated and hands back an account. */
export default function PasswordReset({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      // Not the button's words: a heading that repeats its own button verbatim
      // reads like a rendering fault. The catalog keeps them as separate keys so
      // a translator cannot collapse them by accident.
      title={t("mail.reset.title")}
      preview={t("mail.reset.preview", { minutes: V.resetMinutes })}
    >
      <Button href={V.link}>{t("mail.reset.button")}</Button>
      <FallbackLink t={t} href={V.link} />
      <P muted>{t("mail.reset.expiry", { minutes: V.resetMinutes })}</P>
      <Divider />
      <P muted>{t("mail.reset.ignore")}</P>
    </Layout>
  );
}
