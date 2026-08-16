import { useQuery } from "@tanstack/react-query";
import { originFor } from "@hull/config";
import { Button, Page } from "@hull/ui";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

export function OrgsPage() {
  const { refreshMe } = useSession();
  const q = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrgs() });

  async function viewAs(id: string) {
    await api.supportStart(id);
    await refreshMe();
    window.location.assign(originFor("web"));
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
                  <Button size="sm" variant="outline" data-testid={`view-as-${o.id}`} onClick={() => void viewAs(o.id)}>
                    View as
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
