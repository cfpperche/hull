import { useState } from "react";
import {
  BrandMark,
  Button,
  Input,
  Label,
  initial,
  useBrand,
  useErrMsg,
  useT,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

/**
 * The first screen after signup, and the only thing between a new account and
 * the product.
 *
 * It carries the profile now, because signup stopped carrying it. The trade is
 * deliberate: the sign-up form asks the least an account can be made of, and
 * what is merely *useful* is asked here, once the person is already through the
 * door and has less reason to abandon.
 *
 * Both fields are required. The workspace always was — the product has nowhere
 * to put you without one — and the name is now too, because a product that has
 * to address somebody by their email address for the rest of the relationship
 * never gets a second chance this cheap to ask.
 *
 * Only here. `PATCH /v1/me` still lets an empty name clear the column, and a
 * test says so: this is a gate on the way in, not a rule about the field. Making
 * the server refuse it would take that away from people who already have an
 * account and have decided they do not want one on it.
 *
 * Deliberately no username field. It is the one thing on the old signup form
 * that could be refused for a reason that is not the applicant's fault, and
 * putting it back on the way in — even optional — reintroduces exactly the
 * rejection this work removed. It lives on the account page.
 */
export function CreateOrgPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { brand, mark } = useBrand();
  const { refreshMe, signOut, me } = useSession();
  const [yourName, setYourName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // The person before the workspace, in the order the form reads.
    if (!yourName.trim()) {
      setError(t("org.yourNameRequired"));
      return;
    }
    if (!orgName.trim()) {
      setError(t("error.orgNameRequired"));
      return;
    }
    setPending(true);
    try {
      // The name first. It is the cheaper call and the one that can still be
      // refused (too long) — failing it here leaves nothing created, where
      // failing after the workspace exists would close this screen with the
      // error unread.
      await api.updateMe({ name: yourName.trim() });
      await api.createOrg({ name: orgName.trim() });
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
          {/* Keyed on the workspace, not on the person: it is the mark that will
              sit in the rail a moment from now, so it is the one worth
              previewing. */}
          <div className="bg-foreground text-background flex size-10 items-center justify-center rounded-lg text-sm font-semibold">
            {initial(orgName)}
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
            <Label htmlFor="your-name">{t("account.name")}</Label>
            <Input
              id="your-name"
              data-testid="your-name"
              autoComplete="name"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="org-name">{t("org.name")}</Label>
            <Input
              id="org-name"
              data-testid="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button
            type="submit"
            data-testid="org-submit"
            /* Same rule as the password screens: dead only while something on
               screen explains it, and here both empty boxes are their own
               explanation. */
            disabled={pending || !yourName.trim() || !orgName.trim()}
            className="h-10"
          >
            {pending ? t("org.creating") : t("common.continue")}
          </Button>
        </form>
      </main>
    </div>
  );
}
