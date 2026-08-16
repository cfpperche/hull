import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, cn, initial } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function OrgSwitcher() {
  const { me, refreshMe } = useSession();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
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
    try {
      await api.switchOrg(id);
      await refreshMe();
      setOpen(false);
    } catch (err) {
      setError(errMsg(err));
    }
  }

  async function addOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setPending(true);
    try {
      await api.createOrg({ name: name.trim() });
      setName("");
      setAdding(false);
      setOpen(false);
      await refreshMe();
      toast.success("Workspace created");
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
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-md text-xs font-semibold">
          {initial(current?.name ?? "H")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight">Hull</span>
          <span className="text-muted-foreground block truncate text-xs">{current?.name ?? "Workspace"}</span>
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
              className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
              onClick={() => void switchTo(org.id)}
            >
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === current?.id ? <Check className="size-3.5" /> : null}
            </button>
          ))}
          <div className="my-1 border-t" />
          {adding ? (
            <form className="grid gap-1.5 p-1" onSubmit={(e) => void addOrg(e)}>
              <Input data-testid="org-new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name" autoFocus />
              {error ? <p className="text-destructive text-xs">{error}</p> : null}
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </form>
          ) : (
            <button
              type="button"
              data-testid="org-add"
              className={cn("text-muted-foreground hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm")}
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5" />
              New workspace
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
