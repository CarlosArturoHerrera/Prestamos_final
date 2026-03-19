"use client"

import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react"
import { 
  BarChart3, 
  Download, 
  TrendingUp, 
  DollarSign, 
  Users, 
  CreditCard,
  AlertCircle,
  Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import * as htmlToImage from 'html-to-image'
import jsPDF from "jspdf"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// Helper para formatear fechas de forma segura
const formatSafeDate = (dateValue: string | Date | null | undefined, formatStr: string): string => {
  if (!dateValue) return "N/A"
  try {
    const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue
    if (isNaN(date.getTime())) return "N/A"
    return format(date, formatStr, { locale: es })
  } catch {
    return "N/A"
  }
}

type Loan = {
  id: string
  client_id: string
  client_name: string
  principal: number
  interest_rate: number
  term_months: number
  status: string
  start_date: string
  created_at: string
}

type Client = {
  id: string
  name: string
  email: string
  segment_id: string
  created_at: string
}

export type ReportsTabRef = {
  exportPDF: () => Promise<void>
}

export const ReportsTab = forwardRef<ReportsTabRef>((_, ref) => {
  const [loans, setLoans] = useState<Loan[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [loansRes, clientsRes] = await Promise.all([
          fetch("/api/loans", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" })
        ])
        
        if (loansRes.ok) {
          const loansData = await loansRes.json()
          setLoans(loansData)
        }
        
        if (clientsRes.ok) {
          const clientsData = await clientsRes.json()
          setClients(clientsData)
        }
      } catch (error) {
        console.error("Error cargando datos:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleExportPDF = async () => {
    if (!reportRef.current) return
    
    setIsExporting(true)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipFonts: false,
        style: {
          backgroundColor: '#ffffff'
        }
      })
      
      const img = new Image()
      img.src = dataUrl
      
      await new Promise((resolve) => {
        img.onload = resolve
      })
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      })
      
      const imgWidth = 210
      const imgHeight = (img.height * imgWidth) / img.width
      
      let heightLeft = imgHeight
      let position = 0
      
      pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight)
      heightLeft -= 297
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(dataUrl, "PNG", 0, position, imgWidth, imgHeight)
        heightLeft -= 297
      }
      
      const fileName = `reporte-cartera-${formatSafeDate(new Date(), "dd-MM-yyyy")}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error("Error generando PDF:", error)
    } finally {
      setIsExporting(false)
    }
  }

  useImperativeHandle(ref, () => ({
    exportPDF: handleExportPDF
  }))

  const stats = useMemo(() => {
    const totalLoans = loans.length
    const activeLoans = loans.filter(l => l.status === "activo").length
    const totalLent = loans.reduce((sum, l) => sum + (Number(l.principal) || 0), 0)
    const avgAmount = totalLoans > 0 ? totalLent / totalLoans : 0
    const avgRate = totalLoans > 0 
      ? loans.reduce((sum, l) => sum + (Number(l.interest_rate) || 0), 0) / totalLoans 
      : 0
    
    const statusBreakdown = loans.reduce((acc, loan) => {
      const status = loan.status || "sin estado"
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Top 5 clientes por monto prestado
    const clientLoans = loans.reduce((acc, loan) => {
      const key = loan.client_name || "Desconocido"
      if (!acc[key]) {
        acc[key] = { name: key, total: 0, count: 0 }
      }
      acc[key].total += (Number(loan.principal) || 0)
      acc[key].count += 1
      return acc
    }, {} as Record<string, { name: string; total: number; count: number }>)

    const topClients = Object.values(clientLoans)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    return {
      totalLoans,
      activeLoans,
      totalLent,
      avgAmount,
      avgRate,
      totalClients: clients.length,
      statusBreakdown,
      topClients
    }
  }, [loans, clients])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-3 mx-auto animate-pulse" />
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reportes</h2>
          <p className="text-muted-foreground mt-2">
            Análisis completo de tu cartera de préstamos
          </p>
        </div>
        <Button 
          onClick={handleExportPDF} 
          disabled={isExporting}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Generando..." : "Exportar PDF"}
        </Button>
      </div>

      {/* Contenido del reporte para exportar */}
      <div ref={reportRef} data-report-content className="space-y-6 rounded-[2rem] border border-border/70 bg-background p-8 text-foreground shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
        {/* Encabezado del reporte */}
        <div className="border-b border-border/80 pb-4">
          <h1 className="text-2xl font-bold text-foreground">Reporte de Cartera</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isMounted ? `Generado el ${formatSafeDate(new Date(), "dd 'de' MMMM 'de' yyyy")}` : "Generando reporte..."}
          </p>
        </div>

        {/* Resumen Ejecutivo */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumen Ejecutivo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border/80 bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Capital Total Prestado</span>
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                ${(stats.totalLent || 0).toLocaleString("es-MX")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Promedio: ${(stats.avgAmount || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Préstamos Activos</span>
                <CreditCard className="h-5 w-5 text-secondary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.activeLoans} / {stats.totalLoans}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.totalLoans > 0 
                  ? ((stats.activeLoans / stats.totalLoans) * 100).toFixed(1)
                  : 0}% del total
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Tasa de Interés Promedio</span>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {(stats.avgRate || 0).toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.totalClients} clientes registrados
              </p>
            </div>
          </div>
        </div>

        {/* Distribución por Estado */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <AlertCircle className="h-5 w-5 text-primary" />
            Distribución por Estado
          </h3>
          <div className="rounded-2xl border border-border/80 bg-surface p-6">
            <div className="space-y-3">
              {Object.entries(stats.statusBreakdown).map(([status, count]) => {
                const percentage = stats.totalLoans > 0 
                  ? ((count / stats.totalLoans) * 100).toFixed(1) 
                  : 0
                
                const statusColors: Record<string, string> = {
                  "activo": "bg-primary",
                  "en revisión": "bg-secondary",
                  "pendiente": "bg-primary/60",
                  "completado": "bg-slate-800",
                  "cancelado": "bg-red-500"
                }
                
                const bgColor = statusColors[status.toLowerCase()] || "bg-slate-400"
                
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize text-foreground">{status}</span>
                      <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-accent">
                      <div 
                        className={`${bgColor} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Top 5 Clientes */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Top 5 Clientes por Monto Prestado
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-foreground">#</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Préstamos</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Monto Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.topClients.length > 0 ? (
                  stats.topClients.map((client, idx) => (
                    <tr key={client.name} className="hover:bg-accent/40">
                      <td className="px-4 py-3 font-medium text-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 text-foreground">{client.name}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{client.count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        ${(client.total || 0).toLocaleString("es-MX")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No hay datos disponibles
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalle de Préstamos Recientes */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            Préstamos Recientes
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium text-foreground">Monto</th>
                  <th className="px-4 py-3 text-center font-medium text-foreground">Tasa</th>
                  <th className="px-4 py-3 text-center font-medium text-foreground">Plazo</th>
                  <th className="px-4 py-3 text-center font-medium text-foreground">Estado</th>
                  <th className="px-4 py-3 text-left font-medium text-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loans.length > 0 ? (
                  loans.slice(0, 10).map((loan) => (
                    <tr key={loan.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{loan.id}</td>
                      <td className="px-4 py-3 text-foreground">{loan.client_name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        ${(Number(loan.principal) || 0).toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{Number(loan.interest_rate) || 0}%</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{Number(loan.term_months) || 0}m</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          loan.status === "activo" ? "bg-primary/12 text-primary" :
                          loan.status === "en revisión" ? "bg-secondary/18 text-secondary-foreground" :
                          loan.status === "completado" ? "bg-slate-800/10 text-slate-800" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatSafeDate(loan.start_date, "dd/MM/yyyy")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      No hay préstamos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer del reporte */}
        <div className="border-t border-border/80 pt-4 text-center text-xs text-muted-foreground">
          <p>Reporte generado automáticamente por Sistema de Gestión de Préstamos</p>
          <p className="mt-1">© {isMounted ? new Date().getFullYear() : "2026"} - Todos los derechos reservados</p>
        </div>
      </div>
    </div>
  )
})
