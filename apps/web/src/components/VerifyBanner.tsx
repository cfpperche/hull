import { useState } from "react";
import { toast } from "sonner";
import { Fill, useT, useErrMsg } from "@hull/ui";
import { api } from "../lib/api";

/**
 * Shown until the address is confirmed.
 *
 * It informs, it does not block. Nothing in Hull requires a verified address
 * yet, and inventing a wall here would be policy the product has not decided —
 * the first thing that will genuinely need it is changing your email.
 */
export function VerifyBanner({ email }: { email: string }) {
  const t = useT();
  const errMsg = useErrMsg();
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    try {
      await api.resendVerification();
      toast.success(t("verify.resent"));
    } catch (err) {
      // Not `void api.resend()`: a swallowed rejection leaves the button back at
      // idle and the operator with no idea whether anything was sent.
      toast.error(errMsg(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      data-testid="verify-banner"
      className="flex items-center justify-between gap-3 border-b bg-muted px-4 py-2 text-sm"
    >
      <p className="text-muted-foreground truncate">
        <Fill
          parts={t.parts("verify.banner")}
          nodes={{
            email: <span className="text-foreground font-medium">{email}</span>,
          }}
        />
      </p>
      <button
        type="button"
        data-testid="verify-resend"
        disabled={sending}
        className="border-input hover:bg-background shrink-0 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60"
        onClick={() => void resend()}
      >
        {sending ? t("verify.resending") : t("verify.resend")}
      </button>
    </div>
  );
}
