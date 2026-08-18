import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  cn,
  initial,
  useBrand,
  useT,
  useErrMsg,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function OrgSwitcher() {
  const t = useT();
  const errMsg = useErrMsg();
  const { brand } = useBrand();
  const { me, refreshMe } = useSession();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const orgs = me?.orgs ?? [];
  const current = me?.org;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function switchTo(id: string) {
    if (!id || id === current?.id) {
      setOpen(false);
      return;
    }
    setError(null);
    setSwitching(id);
    try {
      await api.switchOrg(id);
      await refreshMe();
      setOpen(false);
    } catch (err) {
      // The popover collapses on the success path, so a failure has nowhere
      // on-screen to live — toast it rather than leave an empty click.
      toast.error(errMsg(err));
    } finally {
      setSwitching(null);
    }
  }

  async function addOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("error.orgNameRequired"));
      return;
    }
    setPending(true);
    try {
      await api.createOrg({ name: name.trim() });
      setName("");
      setAdding(false);
      setOpen(false);
      await refreshMe();
      toast.success(t("org.created"));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="org-switcher"
        aria-expanded={open}
        className="hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md px-1 py-1 text-left"
        onClick={() => {
          setError(null);
          setOpen((v) => !v);
        }}
      >
        <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-md text-xs font-semibold">
          {initial(current?.name ?? "H")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight">
            {brand}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {current?.name ?? t("org.fallback")}
          </span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
      </button>
      {open ? (
        <div className="bg-popover absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border p-1 shadow-md">
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              data-testid={`org-${org.id}`}
              disabled={switching !== null}
              className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-60"
              onClick={() => void switchTo(org.id)}
            >
              <span className="flex-1 truncate">{org.name}</span>
              {switching === org.id ? (
                <span className="text-muted-foreground text-xs">
                  {t("org.switching")}
                </span>
              ) : org.id === current?.id ? (
                <Check className="size-3.5" />
              ) : null}
            </button>
          ))}
          <div className="my-1 border-t" />
          {adding ? (
            <form className="grid gap-1.5 p-1" onSubmit={(e) => void addOrg(e)}>
              <Input
                data-testid="org-new-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("org.name")}
                autoFocus
              />
              {error ? (
                <p className="text-destructive text-xs">{error}</p>
              ) : null}
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("org.adding") : t("org.add")}
              </Button>
            </form>
          ) : (
            <button
              type="button"
              data-testid="org-add"
              className={cn(
                "text-muted-foreground hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              )}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5" />
              {t("org.new")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
