import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SupportBanner({ orgName }: { orgName: string }) {
  const { refreshMe } = useSession();
  return (
    <div
      data-testid="support-banner"
      className="flex items-center justify-between gap-3 border-b bg-foreground px-4 py-2 text-sm text-background"
    >
      <p>
        Viewing as <span className="font-medium">{orgName}</span>
      </p>
      <button
        type="button"
        data-testid="support-stop"
        className="rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground"
        onClick={() => void api.supportStop().then(() => refreshMe())}
      >
        Stop
      </button>
    </div>
  );
}
