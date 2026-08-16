import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Label, Page, ThemePreference } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function AccountPage() {
  const { me, refreshMe, signOut } = useSession();
  const [name, setName] = useState(me?.user.name ?? "");
  const [username, setUsername] = useState(me?.user.username ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePending, setProfilePending] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwPending, setPwPending] = useState(false);
  const [closePw, setClosePw] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfilePending(true);
    try {
      await api.updateMe({ name: name.trim(), username: username.trim() });
      await refreshMe();
      toast.success("Profile saved");
    } catch (err) {
      setProfileError(errMsg(err));
    } finally {
      setProfilePending(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwPending(true);
    try {
      await api.changePassword({ current, password: next });
      setCurrent("");
      setNext("");
      toast.success("Password updated");
    } catch (err) {
      setPwError(errMsg(err));
    } finally {
      setPwPending(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPending(true);
    try {
      await api.uploadAvatar(file);
      await refreshMe();
      toast.success("Photo updated");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setAvatarPending(false);
      e.target.value = "";
    }
  }

  async function closeAccount(e: React.FormEvent) {
    e.preventDefault();
    setCloseError(null);
    setClosing(true);
    try {
      await api.closeAccount({ password: closePw });
      await signOut();
    } catch (err) {
      setCloseError(errMsg(err));
    } finally {
      setClosing(false);
    }
  }

  return (
    <Page title="Account" description="This login. Theme is this browser only.">
      <div className="grid max-w-md gap-10">
        <form className="grid gap-4" onSubmit={(e) => void saveProfile(e)}>
          <div className="grid gap-1.5">
            <Label htmlFor="photo">Photo</Label>
            <Input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onAvatar(e)} disabled={avatarPending} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={me?.user.email ?? ""} readOnly disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" data-testid="profile-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          {profileError ? <p className="text-destructive text-sm">{profileError}</p> : null}
          <Button type="submit" data-testid="profile-save" disabled={profilePending}>
            {profilePending ? "Saving…" : "Save profile"}
          </Button>
        </form>

        <div className="grid gap-2">
          <h2 className="text-sm font-medium">Appearance</h2>
          <ThemePreference />
        </div>

        <form className="grid gap-4" onSubmit={(e) => void savePassword(e)}>
          <h2 className="text-sm font-medium">Password</h2>
          <div className="grid gap-1.5">
            <Label htmlFor="current">Current</Label>
            <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="next">New</Label>
            <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          {pwError ? <p className="text-destructive text-sm">{pwError}</p> : null}
          <Button type="submit" disabled={pwPending}>
            {pwPending ? "Updating…" : "Update password"}
          </Button>
        </form>

        <form className="grid gap-4" onSubmit={(e) => void closeAccount(e)}>
          <h2 className="text-sm font-medium">Close account</h2>
          <p className="text-muted-foreground text-sm">Deletes this login and workspaces only you own.</p>
          <Input type="password" data-testid="close-password" placeholder="Password" value={closePw} onChange={(e) => setClosePw(e.target.value)} />
          {closeError ? <p className="text-destructive text-sm">{closeError}</p> : null}
          <Button type="submit" variant="destructive" data-testid="close-account" disabled={closing}>
            {closing ? "Closing…" : "Close account"}
          </Button>
        </form>
      </div>
    </Page>
  );
}
