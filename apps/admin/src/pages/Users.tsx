import { useQuery } from "@tanstack/react-query";
import { Page } from "@hull/ui";
import { api } from "../lib/api";

export function UsersPage() {
  const q = useQuery({ queryKey: ["admin-users"], queryFn: () => api.adminUsers() });
  return (
    <Page title="Users" description="Every login on this install.">
      {q.isError ? <p className="text-destructive text-sm">Could not load users.</p> : null}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Username</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-t" data-testid={`user-${u.id}`}>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.username ?? "—"}</td>
                <td className="px-4 py-2">{u.platform_role ?? "member"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
