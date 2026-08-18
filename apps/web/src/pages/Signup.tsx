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
  usePasswordMatch,
} from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SignupPage() {
  const t = useT();
  const errMsg = useErrMsg();
  const { refreshMe } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const match = usePasswordMatch(password, confirm);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError(t("signup.invalid"));
      return;
    }
    // The truth rather than the debounced message: somebody who types two
    // different passwords and presses the button inside the wait must still be
    // refused, and `reveal` puts the reason on screen without the pause. The
    // server never sees the second box — this guards a typo locking someone out
    // of an account created seconds ago, not an attacker.
    if (!match.ok) {
      match.reveal();
      return;
    }
    setPending(true);
    try {
      await api.signup({ email: email.trim(), password });
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
            aria-invalid={match.message ? true : undefined}
            aria-describedby={
              match.message ? "password-again-error" : undefined
            }
          />
          {/* Under the field it belongs to, not in the form's error slot:
              harness/action-feedback.md puts schema validation next to the
              field, and the slot below is for what the API refused. */}
          {match.message ? (
            <p
              id="password-again-error"
              data-testid="auth-password-mismatch"
              className="text-destructive text-sm"
            >
              {match.message}
            </p>
          ) : null}
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="auth-submit" disabled={pending}>
          {pending ? t("signup.pending") : t("signup.submit")}
        </Button>
      </form>
    </AuthScreen>
  );
}
