import { useQuery } from "@tanstack/react-query";
import { Page, useT } from "@hull/ui";
import { api } from "../lib/api";

export function UsersPage() {
  const t = useT();
  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.adminUsers(),
  });
  return (
    <Page
      title={t("admin.users.title")}
      description={t("admin.users.description")}
    >
      {q.isError ? (
        <p className="text-destructive text-sm">{t("admin.users.error")}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">
                {t("admin.users.email")}
              </th>
              <th className="px-4 py-2 font-medium">
                {t("admin.users.username")}
              </th>
              <th className="px-4 py-2 font-medium">{t("admin.users.role")}</th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.users ?? []).map((u) => (
              <tr
                key={u.id}
                className="hover:bg-muted/40 border-t"
                data-testid={`user-${u.id}`}
              >
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.username ?? "—"}</td>
                <td className="px-4 py-2">
                  {u.platform_role === "platform_admin"
                    ? t("admin.users.roleAdmin")
                    : t("admin.users.roleMember")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
