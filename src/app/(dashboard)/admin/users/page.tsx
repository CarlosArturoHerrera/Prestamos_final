import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserAndRole } from "@/lib/api-auth";
import { UsersTable } from "@/components/admin/users-table";

export const metadata = { title: "Administración de Usuarios" };

export default async function AdminUsersPage() {
  // Server-side role check — this is the real guard
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) redirect("/login");
  if (!session.isActive) redirect("/login?error=inactive");
  if (session.role !== "super_admin") redirect("/403");

  // Fetch users via admin client (service role, bypasses RLS)
  let users: AdminUser[] = [];
  try {
    const adminClient = createSupabaseAdminClient();

    const [{ data: profiles }, { data: authData }] = await Promise.all([
      adminClient
        .from("profiles")
        .select("id, role, full_name, email, is_active, created_at, updated_at")
        .order("created_at", { ascending: true }),
      adminClient.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const authMap = new Map(
      (authData?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
    );

    users = (profiles ?? []).map((p) => ({
      id: p.id,
      role: p.role as "super_admin" | "admin",
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      is_active: p.is_active,
      created_at: p.created_at,
      updated_at: p.updated_at,
      last_sign_in_at: authMap.get(p.id) ?? null,
    }));
  } catch (err) {
    console.error("[admin/users page]", err);
    // Render the page with empty data; the table will show an error state
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
          Administración de Usuarios
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona los administradores del sistema. Solo el Super Admin puede
          acceder a esta sección.
        </p>
      </div>
      <UsersTable
        users={users}
        currentUserId={session.userId}
        currentUserRole={session.role}
      />
    </div>
  );
}

export type AdminUser = {
  id: string;
  role: "super_admin" | "admin";
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
};
