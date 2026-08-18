import { useState } from "react";
import {
  BrandMark,
  Button,
  Input,
  Label,
  initial,
  useBrand,
  useT,
  useErrMsg,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function CreateOrgPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { brand, mark } = useBrand();
  const { refreshMe, signOut, me } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("org.nameRequired"));
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
          <button
            type="button"
            className="underline"
            data-testid="sign-out"
            onClick={() => void signOut()}
          >
            {t("auth.signOut")}
          </button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-foreground text-background flex size-10 items-center justify-center rounded-lg text-sm font-semibold">
            {initial(name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("org.createTitle")}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {t("org.createDescription")}
            </p>
          </div>
        </div>
        <form className="grid gap-5" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-1.5">
            <Label htmlFor="org-name">{t("org.name")}</Label>
            <Input
              id="org-name"
              data-testid="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button
            type="submit"
            data-testid="org-submit"
            disabled={pending}
            className="h-10"
          >
            {pending ? t("org.creating") : t("common.continue")}
          </Button>
        </form>
      </main>
    </div>
  );
}
