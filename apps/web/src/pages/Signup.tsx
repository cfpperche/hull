import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  AuthScreen,
  Button,
  Input,
  Label,
  useBrand,
  useT,
  useErrMsg,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SignupPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { refreshMe } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !email.trim() || password.length < 8) {
      setError(t("signup.invalid"));
      return;
    }
    // Before the request, and inline rather than a toast: this is field
    // validation. The server never sees the second box — it guards against a
    // typo locking somebody out of an account they just created, which is not
    // a security control and should not pretend to be one.
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setPending(true);
    try {
      await api.signup({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      await refreshMe();
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
      title={t("signup.title")}
      description={t("signup.description")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link
            to="/signin"
            className="text-foreground underline"
            data-testid="auth-to-signin"
          >
            {t("auth.signIn")}
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="username">{t("signup.username")}</Label>
          <Input
            id="username"
            data-testid="auth-username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            data-testid="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            data-testid="auth-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password-again">{t("auth.passwordAgain")}</Label>
          <Input
            id="password-again"
            data-testid="auth-password-again"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="auth-submit" disabled={pending}>
          {pending ? t("signup.pending") : t("signup.submit")}
        </Button>
      </form>
    </AuthScreen>
  );
}
