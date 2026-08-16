import { useState } from "react";
import { BrandMark, Button, Input, Label, initial, useBrand } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function CreateOrgPage() {
  const { brand, mark } = useBrand();
  const { refreshMe, signOut, me } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setPending(true);
    try {
      await api.createOrg({ name: name.trim() });
      await refreshMe();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <BrandMark brand={brand} mark={mark} />
        <div className="text-muted-foreground flex items-center gap-3 text-sm">
          <span className="truncate">{me?.user.email}</span>
          <button type="button" className="underline" data-testid="sign-out" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-foreground text-background flex size-10 items-center justify-center rounded-lg text-sm font-semibold">
            {initial(name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Name your workspace</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">One field. You can add more later.</p>
          </div>
        </div>
        <form className="grid gap-5" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-1.5">
            <Label htmlFor="org-name">Workspace name</Label>
            <Input id="org-name" data-testid="org-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button type="submit" data-testid="org-submit" disabled={pending} className="h-10">
            {pending ? "Creating…" : "Continue"}
          </Button>
        </form>
      </main>
    </div>
  );
}
