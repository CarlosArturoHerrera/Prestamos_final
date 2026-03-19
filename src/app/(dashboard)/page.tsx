"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LayoutDashboard, Users, Package, BarChart3, Bell } from "lucide-react"

import { DashboardTab } from "@/components/dashboard/dashboard-tab"
import { ClientsTab } from "@/components/dashboard/clients-tab"
import { CarteraTab } from "@/components/dashboard/cartera-tab"
import { NotificationsTab } from "@/components/dashboard/notificaciones-tab"
import { ReportsTab } from "@/components/dashboard/reports-tab"

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard")

  return (
    <main className="page-shell">
      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-5 mb-8 h-auto">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4 hidden sm:block" />
              <span>Panel</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Users className="h-4 w-4 hidden sm:block" />
              <span>Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="prestamos" className="gap-2">
              <Package className="h-4 w-4 hidden sm:block" />
              <span>Préstamos</span>
            </TabsTrigger>
            <TabsTrigger value="notificaciones" className="gap-2">
              <Bell className="h-4 w-4 hidden sm:block" />
              <span>Notificaciones</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4 hidden sm:block" />
              <span>Reportes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <DashboardTab />
          </TabsContent>

          <TabsContent value="clients" className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <ClientsTab />
          </TabsContent>

          <TabsContent value="prestamos" className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <CarteraTab />
          </TabsContent>

          <TabsContent value="notificaciones" className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <ReportsTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}
