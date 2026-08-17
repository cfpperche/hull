import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { HullApi, HullMe } from "@hull/api-client";
import { errMsg } from "@hull/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Photo, name, username — who this login is.
 *
 * `onSaved` is how each surface refreshes whatever it draws from these: the
 * product also has to bust its avatar cache, and the console does not.
 */
export function ProfileForm({
  api,
  me,
  onSaved,
}: {
  api: Pick<HullApi, "updateMe" | "uploadAvatar">;
  me: HullMe | null;
  onSaved?: () => void | Promise<void>;
}) {
  const [name, setName] = useState(me?.user.name ?? "");
  const [username, setUsername] = useState(me?.user.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPending, setAvatarPending] = useState(false);

  // Keep the inputs in step with what the server actually stored, so the form
  // can never show a value that was not saved.
  useEffect(() => {
    setName(me?.user.name ?? "");
    setUsername(me?.user.username ?? "");
  }, [me?.user.name, me?.user.username]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      // `name` is always sent, so an empty value clears it. `username` is sent
      // only when non-empty — omitting it leaves the stored one alone rather
      // than failing validation for a user who has never set one.
      const body: { name: string; username?: string } = { name: name.trim() };
      if (username.trim()) body.username = username.trim();
      await api.updateMe(body);
      await onSaved?.();
      toast.success("Profile saved");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setPending(false);
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
      await onSaved?.();
      toast.success("Photo updated");
    } catch (err) {
      setAvatarError(errMsg(err));
    } finally {
      setAvatarPending(false);
      e.target.value = "";
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(e) => void save(e)}>
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
        <Input
          id="username"
          data-testid="profile-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" className="w-fit" data-testid="profile-save" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
