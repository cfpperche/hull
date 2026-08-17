import { useState } from "react";
import { toast } from "sonner";
import type { HullApi } from "@hull/api-client";
import { errMsg } from "@hull/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/**
 * Change the password.
 *
 * Every session of this user dies with it, including this one — the server
 * issues a fresh cookie so the caller stays signed in, which is why there is no
 * navigation to do here.
 */
export function PasswordForm({ api }: { api: Pick<HullApi, "changePassword"> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.changePassword({ current, password: next });
      setCurrent("");
      setNext("");
      toast.success("Password updated");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 border-t pt-8" onSubmit={(e) => void save(e)}>
      <h2 className="text-sm font-medium">Password</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="current">Current</Label>
        <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="next">New</Label>
        <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
