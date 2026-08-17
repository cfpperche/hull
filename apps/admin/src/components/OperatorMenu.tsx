import { LogOut } from "lucide-react";
import { UserMenu } from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

/**
 * Who is operating this console.
 *
 * The foot of the rail used to be a bare "Sign out" — no name, no face, nothing
 * to say which operator you were. That matters more here than on the product
 * surface: every "View as" writes this person's address into `install_events`,
 * and an operator who cannot see whose account they are in cannot tell whose
 * name is going on the record.
 *
 * One item, on purpose. There is no account page on this host — the operator's
 * own profile lives on the product surface, which a platform admin is bounced
 * away from — so a second entry would point nowhere.
 */
export function OperatorMenu() {
  const { me, signOut } = useSession();
  const email = me?.user.email ?? "";

  return (
    <UserMenu
      name={me?.user.name?.trim() || email || "Operator"}
      handle={me?.user.username ? `@${me.user.username}` : email}
      avatarUrl={me?.user.has_avatar ? api.avatarUrl() : null}
      initial={(email[0] ?? "?").toUpperCase()}
      items={[{ label: "Sign out", icon: LogOut, testId: "sign-out", onSelect: () => void signOut() }]}
    />
  );
}
