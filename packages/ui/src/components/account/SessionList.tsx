import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { HullApi, HullSession } from "@hull/api-client";
import { errMsg } from "@hull/api-client";
import type { Locale } from "@hull/i18n";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useLocale, useT } from "../LocaleProvider";

/**
 * "just now" / "4 minutes ago" / "3 days ago", in the account's language.
 *
 * The locale is passed, never left to default. `Intl.RelativeTimeFormat(undefined)`
 * takes the *browser's* language, which is how this line came to read
 * "Last used há 4 minutos" on an otherwise English page — the half-translated
 * sentence ADR-0016 was written to remove.
 */
function ago(iso: string, locale: Locale, justNow: string): string {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return justNow;
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size)
      return fmt.format(Math.round(seconds / size), unit);
  }
  return justNow;
}

/**
 * Where this login is signed in, and the way to end any of it.
 *
 * Takes the client rather than importing one, because both surfaces need this
 * and each builds its own. An operator has a particular reason to read it: a
 * support session shows up here, marked, and it is theirs.
 */
export function SessionList({
  api,
}: {
  api: Pick<HullApi, "listSessions" | "revokeSession" | "revokeOtherSessions">;
}) {
  const t = useT();
  const locale = useLocale();
  const [sessions, setSessions] = useState<HullSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The id being revoked, or "others" for the bulk action. One value, because
  // only one of them can be in flight at a time.
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);

  const load = useCallback(async () => {
    try {
      const { sessions: next } = await api.listSessions();
      setSessions(next);
      setError(null);
    } catch (err) {
      setError(errMsg(err));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(session: HullSession) {
    setBusy(session.id);
    try {
      await api.revokeSession(session.id);
      // Re-read rather than splice the row out locally: the list is the answer to
      // "where am I signed in", and a client-side guess is exactly the thing
      // somebody checking it does not want.
      await load();
      toast.success(t("sessions.ended"));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  async function revokeOthers() {
    setBusy("others");
    try {
      await api.revokeOtherSessions();
      setConfirmOthers(false);
      await load();
      toast.success(t("sessions.revokeOthers.done"));
    } catch (err) {
      setConfirmOthers(false);
      setError(errMsg(err));
    } finally {
      setBusy(null);
    }
  }

  const others = (sessions ?? []).filter((s) => !s.current).length;

  return (
    <div className="grid gap-4 border-t pt-8">
      <h2 className="text-sm font-medium">{t("sessions.title")}</h2>
      <p className="text-muted-foreground text-sm">{t("sessions.blurb")}</p>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {sessions === null ? (
        <p className="text-muted-foreground text-sm">{t("app.loading")}</p>
      ) : (
        <ul className="grid gap-2" data-testid="session-list">
          {sessions.map((s) => (
            <li
              key={s.id}
              data-testid="session-row"
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm">
                  {s.device}
                  {s.support ? (
                    <span className="text-muted-foreground">
                      {t("sessions.support")}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {s.current
                    ? t("sessions.thisDevice")
                    : t("sessions.lastUsed", {
                        ago: ago(s.last_seen_at, locale, t("sessions.justNow")),
                      })}
                </span>
              </span>
              {/* No revoke on the current row. Ending it is signing out, which
                  already has a control of its own in the menu — offering it
                  twice under a different name only invites the misclick. */}
              {s.current ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0"
                  data-testid="session-revoke"
                  disabled={busy !== null}
                  onClick={() => void revoke(s)}
                >
                  {busy === s.id ? t("sessions.ending") : t("sessions.end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others > 0 ? (
        <Button
          type="button"
          /* Not destructive. Close account is the red one on the product's
             account page, and it is the one that cannot be undone — this costs
             a re-login. Two reds on one page teaches people to ignore both. */
          variant="outline"
          className="w-fit"
          data-testid="session-revoke-others"
          disabled={busy !== null}
          onClick={() => setConfirmOthers(true)}
        >
          {t("sessions.revokeOthers")}
        </Button>
      ) : null}

      {/* A dialog for the plural action only. One row is the safety action
          itself and costs a re-login if misclicked; this one reaches every
          device at once. */}
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title={t("sessions.revokeOthers.confirmTitle")}
        /* The whole sentence per plural form, not "session"/"sessions" glued to
           a number: English pluralises the noun and nothing else, and assuming
           that is how it works everywhere is how a catalog becomes
           untranslatable one convenience at a time. */
        description={t.plural("sessions.revokeOthers.confirmBody", others)}
        confirmLabel={t("sessions.revokeOthers")}
        pendingLabel={t("sessions.ending")}
        pending={busy === "others"}
        onConfirm={() => void revokeOthers()}
      />
    </div>
  );
}
