import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "../lib/utils";
import { useT } from "./LocaleProvider";

const OPTIONS = [
  { value: "light", key: "theme.light" },
  { value: "system", key: "theme.system" },
  { value: "dark", key: "theme.dark" },
] as const;

export function ThemePreference() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const current = ready && theme ? theme : "system";

  return (
    <div className="grid gap-2">
      <div
        className="flex rounded-lg border p-0.5"
        role="radiogroup"
        aria-label={t("account.appearance.title")}
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={current === o.value}
            data-testid={`theme-${o.value}`}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm",
              current === o.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTheme(o.value)}
          >
            {t(o.key)}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t("theme.hint")}</p>
    </div>
  );
}
