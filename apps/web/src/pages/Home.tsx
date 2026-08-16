import { Page } from "@hull/ui";
import { useSession } from "../lib/session";

export function HomePage() {
  const { me } = useSession();
  return (
    <Page title="Home" description="Empty on purpose. A product module fills this slot.">
      <div className="rounded-xl border p-6">
        <p className="text-sm font-medium">{me?.org?.name}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Signed in as {me?.user.username ? `@${me.user.username}` : me?.user.email}. Add a module under{" "}
          <code className="text-foreground">modules/</code> — this page stays quiet until then.
        </p>
      </div>
    </Page>
  );
}
