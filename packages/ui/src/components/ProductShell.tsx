import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { cn } from "../lib/utils";

export type ShellNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  external?: boolean;
};

export type ShellNavGroup = {
  label?: string;
  items: ShellNavItem[];
};

export function ProductShell({
  brand,
  mark = "H",
  brandHint,
  lead,
  banner,
  nav,
  footer,
}: {
  brand: string;
  mark?: string;
  brandHint?: ReactNode;
  lead?: ReactNode;
  banner?: ReactNode;
  nav: ShellNavItem[] | ShellNavGroup[];
  footer?: ReactNode;
}) {
  const groups: ShellNavGroup[] =
    nav[0] !== undefined && "items" in nav[0]
      ? (nav as ShellNavGroup[])
      : [{ items: nav as ShellNavItem[] }];
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="bg-background flex h-svh overflow-hidden">
      {open ? (
        <button
          type="button"
          data-testid="nav-dismiss"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground z-50 flex h-svh w-56 shrink-0 flex-col border-r",
          "fixed inset-y-0 left-0 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="shrink-0 px-3 py-3">
          {lead ?? (
            <div className="flex items-center gap-2.5 px-1">
              <div className="bg-foreground text-background flex size-7 items-center justify-center rounded-md text-xs font-semibold">
                {mark}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">{brand}</p>
                {brandHint ? (
                  <div className="text-muted-foreground truncate text-xs">{brandHint}</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-2">
          {groups.map((group, i) => (
            <div key={group.label ?? `g-${i}`} className="flex flex-col gap-0.5">
              {group.label ? (
                <p className="text-muted-foreground px-2 pt-1 text-[10px] font-medium tracking-wide uppercase">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) =>
                item.external ? (
                  <a
                    key={item.to}
                    href={item.to}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </a>
                ) : (
                  <NavLink key={item.to} to={item.to} end={item.end}>
                    {({ isActive }) => (
                      <span
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </nav>
        {footer ? <div className="shrink-0 border-t p-3">{footer}</div> : null}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {banner}
        <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2 md:hidden">
          <button
            type="button"
            data-testid="nav-open"
            aria-label="Open menu"
            className="text-foreground hover:bg-muted rounded-md p-1.5"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-semibold tracking-tight">{brand}</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <AppErrorBoundary key={location.pathname}>
            <Outlet />
          </AppErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export function Page({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-8 py-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          ) : (
            title
          )}
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
