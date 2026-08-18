import { Page, useT } from "@hull/ui";
import { useSession } from "../lib/session";

export function HomePage() {
  const t = useT();
  const { me } = useSession();
  return (
    <Page
      title={me?.org?.name ?? t("home.title")}
      description={t("home.empty")}
    />
  );
}
