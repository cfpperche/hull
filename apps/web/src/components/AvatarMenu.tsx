import { LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router";
import { UserMenu, useT } from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function AvatarMenu() {
  const t = useT();
  const { me, signOut, avatarVersion } = useSession();
  const navigate = useNavigate();
  const email = me?.user.email ?? "";
  const has = Boolean(me?.user.has_avatar);

  return (
    <UserMenu
      name={me?.user.name?.trim() || email || t("account.title")}
      handle={me?.user.username ? `@${me.user.username}` : email}
      /* Busted on avatarVersion, not the user id: keying the URL on an immutable
         value meant replacing a photo never changed the src, so the chrome kept
         the old image while the toast said otherwise. */
      avatarUrl={has ? `${api.avatarUrl()}?v=${avatarVersion}` : null}
      initial={(email[0] ?? "?").toUpperCase()}
      items={[
        {
          label: t("account.title"),
          icon: UserRound,
          testId: "menu-account",
          onSelect: () => navigate("/account"),
        },
        {
          label: t("auth.signOut"),
          icon: LogOut,
          testId: "sign-out",
          onSelect: () => void signOut(),
        },
      ]}
    />
  );
}
