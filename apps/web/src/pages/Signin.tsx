import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, Input, Label } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { originFor } from "@hull/config";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SigninPage() {
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

  return (
    <div className="mx-auto grid w-full max-w-sm gap-6 px-6 py-16">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-sm">Email and password.</p>
      </div>
      <form className="grid gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" data-testid="auth-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" data-testid="auth-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" data-testid="auth-submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        No account?{" "}
        <Link to="/signup" className="text-foreground underline" data-testid="auth-to-signup">
          Create one
        </Link>
      </p>
    </div>
  );
}
