import { Page } from "@hull/ui";
import { useSession } from "../lib/session";

export function OverviewPage() {
  const { me } = useSession();
  return (
    <Page title="Overview" description="This install. Product chrome lives on the app host.">
      <div className="rounded-xl border p-6">
        <p className="text-sm">Signed in as {me?.user.email}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Users, workspaces, and support impersonation. No product data here.
        </p>
      </div>
    </Page>
  );
}
