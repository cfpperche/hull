import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Button, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/**
 * Signup. One mail, not two — a welcome and a separate "confirm your address"
 * arriving together is the pair people learn to ignore, and the link is the only
 * part of either that does anything.
 */
export default function WelcomeVerify({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      title={t("mail.welcome.title")}
      preview={t("mail.welcome.preview")}
      lead={t("mail.welcome.lead")}
    >
      <P>{t("mail.welcome.confirm")}</P>
      <Button href={V.link}>{t("mail.verify.button")}</Button>
      <FallbackLink t={t} href={V.link} />
      <P muted>{t("mail.verify.expiry", { days: V.verifyDays })}</P>
    </Layout>
  );
}
