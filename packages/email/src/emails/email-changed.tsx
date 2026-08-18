import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Divider, Fill, Layout, P } from "../Layout";
import { V } from "../vars";

/** To the old address, after the move. The last mail it will get. No button, for
 *  the same reason as the notice. */
export default function EmailChanged({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      title={t("mail.changed.title")}
      preview={t("mail.changed.preview", { newEmail: V.newEmail })}
      lead={
        <Fill
          parts={t.parts("mail.changed.lead")}
          nodes={{ newEmail: <strong>{V.newEmail}</strong> }}
        />
      }
    >
      <P>{t("mail.changed.body", { oldEmail: V.oldEmail })}</P>
      <Divider />
      <P>{t("mail.changed.warn")}</P>
    </Layout>
  );
}
