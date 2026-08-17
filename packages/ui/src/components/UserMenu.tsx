import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronsUpDown } from "lucide-react";

export type UserMenuItem = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  testId?: string;
};

export type UserMenuProps = {
  /** What to call this person: display name, or the address if they have none. */
  name: string;
  /** The quieter second line — `@handle`, or the address again. */
  handle: string;
  /** Already cache-busted by the caller. Falls back to `initial` when absent. */
  avatarUrl?: string | null;
  initial: string;
  items: UserMenuItem[];
};

/**
 * The identity block at the foot of the rail.
 *
 * Presentation only — it is handed a name, a picture and a list of things to do,
 * and knows nothing about sessions, avatars or routing. That is what lets both
 * the product and the admin console use it while they disagree about what
 * belongs in the menu: the console has no account page, so it offers one item.
 *
 * It exists because the console had no identity block at all — just a bare "Sign
 * out" — and an operator whose name is written into every support event has a
 * particular reason to be able to see which operator they are.
 */
export function UserMenu({ name, handle, avatarUrl, initial, items }: UserMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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
          {avatarUrl ? <img src={avatarUrl} alt="" className="size-7 object-cover" /> : initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight">{name}</span>
          <span className="text-muted-foreground block truncate text-xs leading-tight">
            {handle}
          </span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
      </button>
      {open ? (
        <div className="bg-popover absolute bottom-full left-0 z-50 mb-1 w-full rounded-lg border p-1 shadow-md">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              data-testid={item.testId}
              className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
