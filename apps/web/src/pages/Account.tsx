import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, ConfirmDialog, Input, Label, Page, ThemePreference } from "@hull/ui";
import { errMsg } from "@hull/api-client";
import { SessionList } from "../components/SessionList";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AccountPage() {
  const { me, refreshMe, signOut, bumpAvatar } = useSession();
  const [name, setName] = useState(me?.user.name ?? "");
  const [username, setUsername] = useState(me?.user.username ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePending, setProfilePending] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPw, setEmailPw] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwPending, setPwPending] = useState(false);
  const [closePw, setClosePw] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPending, setAvatarPending] = useState(false);

  // Keep the inputs in step with what the server actually stored, so the form
  // can never show a value that was not saved.
  useEffect(() => {
    setName(me?.user.name ?? "");
    setUsername(me?.user.username ?? "");
  }, [me?.user.name, me?.user.username]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfilePending(true);
    try {
      // `name` is always sent, so an empty value clears it. `username` is sent
      // only when non-empty — omitting it leaves the stored one alone rather
      // than failing validation for a user who has never set one.
      const body: { name: string; username?: string } = { name: name.trim() };
      if (username.trim()) body.username = username.trim();
      await api.updateMe(body);
      await refreshMe();
      toast.success("Profile saved");
    } catch (err) {
      setProfileError(errMsg(err));
    } finally {
      setProfilePending(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSent(null);
    setEmailPending(true);
    try {
      const asked = newEmail.trim();
      await api.changeEmail({ password: emailPw, email: asked });
      // Deliberately no refreshMe(): the server changed nothing yet, and
      // re-reading the principal here would only reprint the old address as if
      // something had happened.
      setEmailSent(asked);
      setNewEmail("");
      setEmailPw("");
    } catch (err) {
      setEmailError(errMsg(err));
    } finally {
      setEmailPending(false);
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
    setAvatarError(null);
    // Reject locally first: the inline slot is on-screen, and a rejected upload
    // should not cost a round trip.
    if (!PHOTO_TYPES.includes(file.type)) {
      setAvatarError("Photo must be a JPEG, PNG, or WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setAvatarError("Photo must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }
    setAvatarPending(true);
    try {
      await api.uploadAvatar(file);
      await refreshMe();
      bumpAvatar();
      toast.success("Photo updated");
    } catch (err) {
      setAvatarError(errMsg(err));
    } finally {
      setAvatarPending(false);
      e.target.value = "";
    }
  }

  async function closeAccount() {
    setCloseError(null);
    setClosing(true);
    try {
      await api.closeAccount({ password: closePw });
      setConfirmClose(false);
      await signOut();
    } catch (err) {
      setConfirmClose(false);
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
            <Label>Photo</Label>
            <label className="border-input hover:bg-muted inline-flex h-8 w-fit cursor-pointer items-center rounded-lg border px-2.5 text-sm">
              {avatarPending ? "Uploading…" : "Upload photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={avatarPending}
                onChange={(e) => void onAvatar(e)}
              />
            </label>
            {avatarError ? <p className="text-destructive text-sm">{avatarError}</p> : null}
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
          <Button type="submit" className="w-fit" data-testid="profile-save" disabled={profilePending}>
            {profilePending ? "Saving…" : "Save profile"}
          </Button>
        </form>

        <form className="grid gap-4 border-t pt-8" onSubmit={(e) => void changeEmail(e)}>
          <h2 className="text-sm font-medium">Email</h2>
          <p className="text-muted-foreground text-sm">
            You sign in with{" "}
            <span className="text-foreground font-medium" data-testid="account-email">
              {me?.user.email}
            </span>
            , and it is where a password reset is sent.
          </p>
          {/* Above the fields, not instead of them: a second attempt with a
              different address must not need a page reload. */}
          {emailSent ? (
            <p className="text-sm" data-testid="email-sent">
              Check <span className="font-medium">{emailSent}</span> for a link. Nothing has changed yet —{" "}
              {me?.user.email} keeps working until that link is used.
            </p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              data-testid="email-new"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email-password">Password</Label>
            <Input
              id="email-password"
              type="password"
              data-testid="email-password"
              value={emailPw}
              onChange={(e) => setEmailPw(e.target.value)}
            />
          </div>
          {emailError ? <p className="text-destructive text-sm">{emailError}</p> : null}
          <Button
            type="submit"
            className="w-fit"
            data-testid="email-submit"
            disabled={emailPending || !newEmail.trim() || !emailPw}
          >
            {emailPending ? "Sending…" : "Change email"}
          </Button>
        </form>

        <div className="grid gap-2 border-t pt-8">
          <h2 className="text-sm font-medium">Appearance</h2>
          <ThemePreference />
        </div>

        <form className="grid gap-4 border-t pt-8" onSubmit={(e) => void savePassword(e)}>
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
          <Button type="submit" className="w-fit" disabled={pwPending}>
            {pwPending ? "Updating…" : "Update password"}
          </Button>
        </form>

        <SessionList />

        <form
          className="grid gap-4 border-t pt-8"
          onSubmit={(e) => {
            e.preventDefault();
            setCloseError(null);
            setConfirmClose(true);
          }}
        >
          <h2 className="text-sm font-medium">Close account</h2>
          <p className="text-muted-foreground text-sm">Deletes this login and workspaces only you own.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="close-password">Password</Label>
            <Input
              id="close-password"
              type="password"
              data-testid="close-password"
              value={closePw}
              onChange={(e) => setClosePw(e.target.value)}
            />
          </div>
          {closeError ? <p className="text-destructive text-sm">{closeError}</p> : null}
          <Button
            type="submit"
            variant="destructive"
            className="w-fit"
            data-testid="close-account"
            disabled={closing || !closePw}
          >
            Close account
          </Button>
        </form>
      </div>

      {/* AGENTS.md: destructive / irreversible takes a dialog before, not after. */}
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        data-testid="close-account-dialog"
        title="Close this account?"
        description={
          <>
            This deletes <span className="text-foreground font-medium">{me?.user.email}</span> and every workspace you
            are the only owner of. Workspaces with other members are kept. It cannot be undone.
          </>
        }
        confirmLabel="Close account"
        pendingLabel="Closing…"
        pending={closing}
        onConfirm={() => void closeAccount()}
      />
    </Page>
  );
}
