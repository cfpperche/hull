import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { originFor } from "@hull/config";
import { errMsg } from "@hull/api-client";
import { Button, Page } from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function OrgsPage() {
  const { refreshMe } = useSession();
  const q = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrgs() });
  const [starting, setStarting] = useState<string | null>(null);

  // A stale row (the workspace was deleted meanwhile) used to reject into `void`
  // and leave the button idle — an empty click, and a second click would open a
  // second support session.
  async function viewAs(id: string) {
    setStarting(id);
    try {
      const { handoff } = await api.supportStart(id);
      // Fragment, not query string: a fragment is never sent to the server, so
      // the token stays out of access logs and out of the Referer header.
      window.location.assign(`${originFor("web")}/handoff#t=${encodeURIComponent(handoff)}`);
    } catch (err) {
      toast.error(errMsg(err));
      setStarting(null);
      void q.refetch();
    }
  }

  return (
    <Page title="Workspaces" description="Support views a workspace without taking the owner's session.">
      {q.isError ? <p className="text-destructive text-sm">Could not load workspaces.</p> : null}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(q.data?.orgs ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-muted/40 border-t" data-testid={`org-${o.id}`}>
                <td className="px-4 py-2">{o.name}</td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`view-as-${o.id}`}
                    disabled={starting !== null}
                    onClick={() => void viewAs(o.id)}
                  >
                    {starting === o.id ? "Opening…" : "View as"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
