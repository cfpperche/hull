import { useState } from "react";
import { toast } from "sonner";
import { LOCALES, LOCALE_NAMES, type Locale } from "@hull/i18n";
import type { HullApi } from "@hull/api-client";
import { errMsg } from "@hull/api-client";
import { cn } from "../../lib/utils";
import { useLocale, useT } from "../LocaleProvider";

/**
 * The account's language. Beside Appearance, and deliberately not the same kind
 * of setting: the theme is this browser, this is the account — it follows the
 * person to any browser, and it is what the mail is written in.
 */
export function LanguagePreference({
  api,
  onSaved,
}: {
  api: Pick<HullApi, "updateMe">;
  onSaved?: () => void | Promise<void>;
}) {
  const t = useT();
  const current = useLocale();
  const [pending, setPending] = useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (next === current || pending) return;
    setPending(next);
    try {
      await api.updateMe({ locale: next });
      await onSaved?.();
      // In the language just chosen, because by the time this is read the rest
      // of the page is in it too.
      toast.success(LOCALE_NAMES[next]);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-2">
      <div
        className="flex rounded-lg border p-0.5"
        role="radiogroup"
        aria-label={t("account.language.title")}
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={current === l}
            data-testid={`locale-${l}`}
            disabled={pending !== null}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm",
              current === l
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => void choose(l)}
          >
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
