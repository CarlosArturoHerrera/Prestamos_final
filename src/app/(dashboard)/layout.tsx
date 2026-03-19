import { AIChatSidebar } from "@/components/dashboard/chat-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarProvider defaultOpen={false} className="overflow-hidden">
      <AIChatSidebar />
      {children}
    </SidebarProvider>
  );
} 