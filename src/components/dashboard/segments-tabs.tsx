"use client"

import { useEffect, useState } from "react"
import { ArrowDownRight } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ClientRow = {
  name: string
  segment: string
  status: string
  balance: string
  risk: string
}

export type LoanRow = {
  id: string
  client: string
  amount: string
  rate: string
  term: string
  status: string
}

export type NotificationItem = {
  title: string
  client: string
  detail: string
}

interface SegmentsTabsProps {
  clients?: ClientRow[]
  loans?: LoanRow[]
  notifications?: NotificationItem[]
}

export function SegmentsTabs({ clients: initialClients = [], loans: initialLoans = [], notifications: initialNotifications = [] }: SegmentsTabsProps) {
  const [clients, setClients] = useState<ClientRow[]>(initialClients)
  const [loans, setLoans] = useState<LoanRow[]>(initialLoans)
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingLoans, setLoadingLoans] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const loadClientsData = async () => {
    setLoadingClients(true)
    try {
      const res = await fetch("/api/dashboard/clients-segment", { cache: "no-store" })
      if (!res.ok) throw new Error("Error cargando clientes")
      const data = await res.json()
      setClients(data)
    } catch (error) {
      console.error(error)
      toast.error("Error cargando clientes")
    } finally {
      setLoadingClients(false)
    }
  }

  const loadLoansData = async () => {
    setLoadingLoans(true)
    try {
      const res = await fetch("/api/dashboard/loans-segment", { cache: "no-store" })
      if (!res.ok) throw new Error("Error cargando préstamos")
      const data = await res.json()
      setLoans(data)
    } catch (error) {
      console.error(error)
      toast.error("Error cargando préstamos")
    } finally {
      setLoadingLoans(false)
    }
  }

  const loadNotificationsData = async () => {
    setLoadingNotifications(true)
    try {
      const res = await fetch("/api/dashboard/notifications-segment", { cache: "no-store" })
      if (!res.ok) throw new Error("Error cargando alertas")
      const data = await res.json()
      setNotifications(data)
    } catch (error) {
      console.error(error)
      toast.error("Error cargando alertas")
    } finally {
      setLoadingNotifications(false)
    }
  }
  return (
    <section className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Profundiza por segmento</p>
          <h2 className="text-xl font-semibold">Clientes, préstamos y alertas</h2>
        </div>
        <Badge variant="secondary" className="gap-1 text-xs">
          <ArrowDownRight className="size-3.5" /> SLA cobranzas 92%
        </Badge>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients" onClick={loadClientsData}>Clientes</TabsTrigger>
          <TabsTrigger value="loans" onClick={loadLoansData}>Préstamos</TabsTrigger>
          <TabsTrigger value="notifications" onClick={loadNotificationsData}>Notificaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Clientes clave</CardTitle>
              <CardDescription>Estado de la cartera prioritaria por segmento.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
              ) : clients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No hay clientes</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Riesgo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.name}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.segment}</TableCell>
                        <TableCell>
                          <Badge
                            variant={client.status === "Al día" ? "secondary" : "outline"}
                            className={client.status.includes("Atraso") ? "bg-orange-500/15 text-orange-600" : undefined}
                          >
                            {client.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{client.balance}</TableCell>
                        <TableCell>
                          <div className="inline-flex items-center gap-2">
                            <span className="size-2 rounded-full bg-emerald-500" />
                            {client.risk}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card className="bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Pipeline de préstamos</CardTitle>
              <CardDescription>Próximos desembolsos y estatus operativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLoans ? (
                <div className="text-center py-8 text-muted-foreground">Cargando préstamos...</div>
              ) : loans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No hay préstamos</div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Tasa</TableHead>
                        <TableHead>Plazo</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-mono text-sm">{loan.id}</TableCell>
                          <TableCell>{loan.client}</TableCell>
                          <TableCell>{loan.amount}</TableCell>
                          <TableCell>{loan.rate}</TableCell>
                          <TableCell>{loan.term}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{loan.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <Badge variant="outline">Capacidad de fondeo 83%</Badge>
                    <Badge variant="outline">Tiempo medio de aprobación 36h</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          {loadingNotifications ? (
            <div className="text-center py-8 text-muted-foreground">Cargando alertas...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No hay alertas</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {notifications.map((item, idx) => (
                <Card key={`${item.title}-${idx}`} className="bg-card/80 border-dashed backdrop-blur">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base flex items-start gap-2">
                      <span className="mt-1 inline-flex size-2 rounded-full bg-primary" />
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs">{item.client}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {item.detail}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
