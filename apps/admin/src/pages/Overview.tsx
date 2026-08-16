import { Page } from "@hull/ui";
import { useSession } from "../lib/session";

export function OverviewPage() {
  const { me } = useSession();
  return (
    <Page title="Overview" description="This install.">
      <p className="text-sm">{me?.user.email}</p>
    </Page>
  );
}
