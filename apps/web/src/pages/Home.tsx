import { Page } from "@hull/ui";
import { useSession } from "../lib/session";

export function HomePage() {
  const { me } = useSession();
  return <Page title={me?.org?.name ?? "Home"} description="Nothing in this workspace yet." />;
}
