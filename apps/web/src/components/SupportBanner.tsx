import { useState } from "react";
import { toast } from "sonner";
import { errMsg } from "@hull/api-client";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function SupportBanner({ orgName }: { orgName: string }) {
  const { refreshMe } = useSession();
  const [stopping, setStopping] = useState(false);

  // This is the only exit from impersonation. A swallowed rejection left the
  // operator unable to tell whether they were still acting as the customer.
  async function stop() {
    setStopping(true);
    try {
      await api.supportStop();
      await refreshMe();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setStopping(false);
    }
  }

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
        disabled={stopping}
        className="rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground disabled:opacity-60"
        onClick={() => void stop()}
      >
        {stopping ? "Stopping…" : "Stop"}
      </button>
    </div>
  );
}
