import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Divider, Fill, Layout, P } from "../Layout";
import { V } from "../vars";

/**
 * To the *old* address, while it can still act. Deliberately no button.
 *
 * This goes to somebody who may not have asked for anything, and a one-click
 * action in a "was this you?" mail teaches exactly the reflex phishing depends
 * on. It says what to do; the person navigates there themselves.
 */
export default function EmailChangeNotice({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      title={t("mail.changeNotice.title")}
      preview={t("mail.changeNotice.preview", { oldEmail: V.oldEmail })}
      lead={
        <Fill
          parts={t.parts("mail.changeNotice.lead")}
          nodes={{ newEmail: <strong>{V.newEmail}</strong> }}
        />
      }
    >
      <P>{t("mail.changeNotice.body", { oldEmail: V.oldEmail })}</P>
      <Divider />
      <P>{t("mail.changeNotice.warn")}</P>
    </Layout>
  );
}
