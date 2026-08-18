import { Page, useT } from "@hull/ui";
import { useSession } from "../lib/session";

export function OverviewPage() {
  const t = useT();
  const { me } = useSession();
  return (
    <Page
      title={t("admin.overview.title")}
      description={t("admin.overview.description")}
    >
      <p className="text-sm">{me?.user.email}</p>
    </Page>
  );
}
