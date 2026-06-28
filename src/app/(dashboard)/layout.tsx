import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { PageTransition } from "@/components/app/page-transition";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndRole } from "@/lib/api-auth";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const session = await getUserAndRole(supabase);

  if (!session) {
    redirect("/login");
  }

  // Inactive accounts cannot access the dashboard
  if (!session.isActive) {
    redirect("/login?error=inactive");
  }

  return (
    <AppShell role={session.role}>
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}
