import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthScreen, Button, Input, Label, useBrand, useT } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { originFor } from "@hull/config";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SigninPage() {
  const t = useT();
  const { refreshMe } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const me = await api.signin({ email: email.trim(), password });
      await refreshMe();
      if (me.platform_role === "platform_admin") {
        window.location.assign(originFor("admin"));
        return;
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  const { brand, mark } = useBrand();
  return (
    <AuthScreen
      brand={brand}
      mark={mark}
      title={t("auth.signIn")}
      description={t("auth.signIn.description")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link
            to="/signup"
            className="text-foreground underline"
            data-testid="auth-to-signup"
          >
            {t("auth.createOne")}
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            data-testid="auth-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link
              to="/forgot"
              className="text-muted-foreground hover:text-foreground text-xs underline"
              data-testid="auth-to-forgot"
            >
              {t("auth.forgot")}
            </Link>
          </div>
          <Input
            id="password"
            data-testid="auth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="auth-submit" disabled={pending}>
          {pending ? t("auth.signIn.pending") : t("auth.signIn")}
        </Button>
      </form>
    </AuthScreen>
  );
}
