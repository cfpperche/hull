import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthScreen, Button, Input, Label, useBrand } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SignupPage() {
  const { refreshMe } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !email.trim() || password.length < 8) {
      setError("Username, email, and a password of at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await api.signup({ username: username.trim(), email: email.trim(), password });
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
      title="Create account"
      description="Username, email, password. You name the workspace next."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="text-foreground underline" data-testid="auth-to-signin">
            Sign in
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" data-testid="auth-username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" data-testid="auth-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="auth-submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthScreen>
  );
}
