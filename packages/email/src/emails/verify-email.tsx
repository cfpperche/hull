import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Button, FallbackLink, Layout, P } from "../Layout";
import { V } from "../vars";

/** The resend, from the banner in the product. */
export default function VerifyEmail({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      title={t("mail.verify.title")}
      preview={t("mail.verify.preview", { days: V.verifyDays })}
    >
      <Button href={V.link}>{t("mail.verify.button")}</Button>
      <FallbackLink t={t} href={V.link} />
      <P muted>{t("mail.verify.expiry", { days: V.verifyDays })}</P>
    </Layout>
  );
}
