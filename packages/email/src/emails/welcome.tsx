import { DEFAULT_LOCALE, createT, type T } from "@hull/i18n";
import { Layout } from "../Layout";

/**
 * Sent at signup when there is nothing to confirm — the defensive branch, for an
 * account that somehow arrives already verified. The ordinary path is
 * welcome-verify.tsx, which carries the link.
 */
/* `t` defaults so `pnpm --filter @hull/email dev` still previews these: the
   react-email dev server mounts each component with no props. The build always
   passes one, once per locale. */
export default function Welcome({ t = createT(DEFAULT_LOCALE) }: { t?: T }) {
  return (
    <Layout
      t={t}
      title={t("mail.welcome.title")}
      preview={t("mail.welcome.preview")}
      lead={t("mail.welcome.lead")}
    >
      <></>
    </Layout>
  );
}
