import { useState } from "react";
import { toast } from "sonner";
import { originFor } from "@hull/config";
import { Fill, useT, useErrMsg } from "@hull/ui";
import { api } from "../lib/api";

export function SupportBanner({ orgName }: { orgName: string }) {
  const t = useT();
  const errMsg = useErrMsg();
  const [stopping, setStopping] = useState(false);

  // This is the only exit from impersonation. A swallowed rejection left the
  // operator unable to tell whether they were still acting as the customer.
  // Stopping ends the impersonating session itself — it is the only thing this
  // host's cookie holds — so there is nothing left to refresh here. Go back to
  // the console the operator came from.
  async function stop() {
    setStopping(true);
    try {
      await api.supportStop();
      window.location.assign(originFor("admin"));
    } catch (err) {
      toast.error(errMsg(err));
      setStopping(false);
    }
  }

  return (
    <div
      data-testid="support-banner"
      className="flex items-center justify-between gap-3 border-b bg-foreground px-4 py-2 text-sm text-background"
    >
      <p>
        <Fill
          parts={t.parts("support.viewingAs")}
          nodes={{ org: <span className="font-medium">{orgName}</span> }}
        />
      </p>
      <button
        type="button"
        data-testid="support-stop"
        disabled={stopping}
        className="rounded-md bg-background px-2 py-1 text-xs font-medium text-foreground disabled:opacity-60"
        onClick={() => void stop()}
      >
        {stopping ? t("support.stopping") : t("support.stop")}
      </button>
    </div>
  );
}
