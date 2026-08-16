import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function AvatarMenu() {
  const { me, signOut } = useSession();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const email = me?.user.email ?? "";
  const name = me?.user.name?.trim() || email || "Account";
  const handle = me?.user.username ? `@${me.user.username}` : email;
  const has = Boolean(me?.user.has_avatar);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="user-menu"
        aria-expanded={open}
        className="hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md px-1 py-1 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bg-foreground text-background flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-semibold">
          {has ? (
            <img src={`${api.avatarUrl()}?t=${me?.user.id}`} alt="" className="size-7 object-cover" />
          ) : (
            (email[0] ?? "?").toUpperCase()
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight">{name}</span>
          <span className="text-muted-foreground block truncate text-xs leading-tight">{handle}</span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
      </button>
      {open ? (
        <div className="bg-popover absolute bottom-full left-0 z-50 mb-1 w-full rounded-lg border p-1 shadow-md">
          <button
            type="button"
            data-testid="menu-account"
            className={cn("hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm")}
            onClick={() => {
              setOpen(false);
              navigate("/account");
            }}
          >
            <UserRound className="size-4" />
            Account
          </button>
          <button
            type="button"
            data-testid="sign-out"
            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
