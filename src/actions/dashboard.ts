"use server"

import { supabase } from "@/lib/supabase"
import type { PortfolioMetric, PortfolioPoint } from "@/components/dashboard/portfolio-chart-card"
import type { ClientRow, LoanRow, NotificationItem } from "@/components/dashboard/segments-tabs"

export type DashboardHighlight = {
  title: string
  value: string
  description: string
  icon: string
}

export type OperationsSnapshot = {
  scheduledAmount: string
  operationsCount: number
  expectedRecoveries: string
  digitalPercentage: number
  cashPercentage: number
  alertText: string
  alertDetail: string
} | null

export type DashboardData = {
  highlights: DashboardHighlight[]
  performance: PortfolioPoint[]
  metrics: PortfolioMetric[]
  operations: OperationsSnapshot
  clients: ClientRow[]
  loans: LoanRow[]
  notifications: NotificationItem[]
}

type QueryResult<T> = { data: T[] | null; error: { message: string } | null }

const currencyCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 0,
})

const currencyPlain = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "DOP",
  maximumFractionDigits: 0,
})

function formatCurrencyCompact(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  return currencyCompact.format(parsed)
}

function formatCurrency(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  return currencyPlain.format(parsed)
}

function formatPercent(value: number | null | undefined, fractionDigits = 1) {
  const parsed = Number(value ?? 0)
  return `${parsed.toFixed(fractionDigits)}%`
}

function mapToneToClasses(tone: string | null | undefined) {
  if (tone === "positive") {
    return {
      helperClassName: "text-emerald-600 dark:text-emerald-400",
      progressClassName: "bg-emerald-500/15",
    }
  }
  if (tone === "negative") {
    return {
      helperClassName: "text-orange-500",
      progressClassName: "bg-orange-500/20",
    }
  }
  return { helperClassName: undefined, progressClassName: undefined }
}

async function assertNoError<T>(
  query: PromiseLike<QueryResult<T>>,
  label: string,
): Promise<T[]> {
  const { data, error } = await query
  if (error) {
    throw new Error(`Supabase ${label} error: ${error.message}`)
  }
  return data ?? []
}

type HighlightRow = {
  title: string
  value: number
  icon: string | null
}

type LoanSumRow = {
  total: number | null
}

type OverdueSumRow = {
  total: number | null
}

type ClientCountRow = {
  count: number | null
}

type PerformanceRow = {
  month: string
  prestado: number | null
  cobrado: number | null
  month_index: number
}

type MetricRow = {
  label: string
  value: string
  helper: string | null
  progress: number | null
  tone: string | null
}

type OperationRow = {
  scheduled_amount: number | null
  operations_count: number | null
  expected_recoveries: number | null
  digital_percentage: number | null
  cash_percentage: number | null
  alert_text: string | null
  alert_detail: string | null
  snapshot_date: string
}

type SegmentRow = {
  id: number
  name: string
}

type ClientDbRow = {
  id: string
  name: string
  segment_id: number | null
}

type LoanDbRow = {
  id: string
  client_id: string
  principal: number
  rate: number
  term_months: number
  status: string
}

type PaymentDbRow = {
  loan_id: string
  due_date: string
  amount_due: number
  amount_paid: number
  paid_at: string | null
  status: string
  created_at: string
}

export async function fetchDashboardData(): Promise<DashboardData> {
  // Calculate highlights from base tables
  const [totalLent, totalOverdue, totalClients, lateClients, performance, metrics, segments, clients, loans, payments] =
    await Promise.all([
      // Total money lent
      assertNoError<LoanSumRow>(
        supabase
          .from("loans")
          .select("principal")
          .then(async (result) => {
            if (result.data) {
              const total = result.data.reduce((sum, loan) => sum + (loan.principal || 0), 0)
              return { data: [{ total }], error: result.error }
            }
            return { data: [{ total: 0 }], error: result.error }
          }),
        "total_lent",
      ),
      // Total overdue amount
      assertNoError<OverdueSumRow>(
        supabase
          .from("payments")
          .select("amount_due, amount_paid, status")
          .in("status", ["vencido", "mora"])
          .then(async (result) => {
            if (result.data) {
              const total = result.data.reduce(
                (sum, payment) => sum + ((payment.amount_due || 0) - (payment.amount_paid || 0)),
                0,
              )
              return { data: [{ total }], error: result.error }
            }
            return { data: [{ total: 0 }], error: result.error }
          }),
        "total_overdue",
      ),
      // Total clients with loans
      assertNoError<ClientCountRow>(
        supabase
          .from("loans")
          .select("client_id", { head: false })
          .then(async (result) => {
            if (result.data) {
              const uniqueClients = new Set(result.data.map((l) => l.client_id)).size
              return { data: [{ count: uniqueClients }], error: result.error }
            }
            return { data: [{ count: 0 }], error: result.error }
          }),
        "total_clients",
      ),
      // Clients with late payments
      assertNoError<ClientCountRow>(
        supabase
          .from("payments")
          .select("loan_id, status")
          .in("status", ["vencido", "mora"])
          .then(async (result) => {
            if (result.data && result.data.length > 0) {
              const loanIds = [...new Set(result.data.map((p) => p.loan_id))]
              return supabase
                .from("loans")
                .select("client_id")
                .in("id", loanIds)
                .then((loansResult) => {
                  if (loansResult.data) {
                    const uniqueClients = new Set(loansResult.data.map((l) => l.client_id)).size
                    return { data: [{ count: uniqueClients }], error: loansResult.error }
                  }
                  return { data: [{ count: 0 }], error: loansResult.error }
                })
            }
            return { data: [{ count: 0 }], error: result.error }
          }),
        "late_clients",
      ),
      assertNoError<PerformanceRow>(
        supabase
          .from("loans")
          .select("principal, start_date")
          .then(async (loansResult) => {
            if (loansResult.data) {
              const paymentsResult = await supabase
                .from("payments")
                .select("loan_id, amount_paid, paid_at, status")
                .eq("status", "pagado")
              
              const paymentsByLoanMonth = new Map<string, number[]>()
              if (paymentsResult.data) {
                paymentsResult.data.forEach((p) => {
                  if (p.paid_at) {
                    const monthKey = p.paid_at.substring(0, 7)
                    if (!paymentsByLoanMonth.has(monthKey)) {
                      paymentsByLoanMonth.set(monthKey, [])
                    }
                    paymentsByLoanMonth.get(monthKey)!.push(p.amount_paid || 0)
                  }
                })
              }

              const now = new Date()
              const months: PerformanceRow[] = []
              for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const monthKey = d.toISOString().substring(0, 7)
                const monthStr = d.toLocaleDateString("en-US", { month: "short" })
                const monthIndex = d.getMonth() + 1

                let prestado = 0
                let cobrado = 0

                loansResult.data.forEach((loan) => {
                  if (loan.start_date) {
                    const loanMonthKey = loan.start_date.substring(0, 7)
                    if (loanMonthKey === monthKey) {
                      prestado += loan.principal || 0
                    }
                  }
                })

                const monthPayments = paymentsByLoanMonth.get(monthKey) || []
                cobrado = monthPayments.reduce((sum, p) => sum + p, 0)

                months.push({
                  month: monthStr,
                  prestado,
                  cobrado,
                  month_index: monthIndex,
                })
              }
              return { data: months, error: loansResult.error }
            }
            return { data: [], error: loansResult.error }
          }),
        "performance",
      ),
      assertNoError<MetricRow>(
        Promise.resolve().then(async () => {
          const loansResult = await supabase.from("loans").select("principal")
          const paymentsResult = await supabase.from("payments").select("amount_due, amount_paid, status")

          const totalLent = loansResult.data?.reduce((sum, loan) => sum + (loan.principal || 0), 0) || 0
          const totalReceived = paymentsResult.data
            ?.filter((p) => p.status === "pagado")
            .reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0
          const pending = paymentsResult.data
            ?.filter((p) => p.status !== "pagado")
            .reduce((sum, p) => sum + ((p.amount_due || 0) - (p.amount_paid || 0)), 0) || 0

          const recoveryPercent = totalLent > 0 ? (totalReceived / totalLent) * 100 : 0
          const pendingPercent = totalLent > 0 ? (pending / totalLent) * 100 : 0

          return {
            data: [
              {
                label: "Total prestado",
                value: formatCurrency(totalLent),
                helper: "Dinero entregado",
                progress: 100,
                tone: "neutral",
              },
              {
                label: "Ya cobrado",
                value: formatCurrency(totalReceived),
                helper: `${recoveryPercent.toFixed(1)}% recuperado`,
                progress: Math.min(100, Math.round(recoveryPercent)),
                tone: "positive",
              },
              {
                label: "Por cobrar",
                value: formatCurrency(pending),
                helper: "Pendiente",
                progress: Math.min(100, Math.round(pendingPercent)),
                tone: pending > totalReceived ? "negative" : "neutral",
              },
            ] as MetricRow[],
            error: null,
          }
        }),
        "metrics",
      ),
      assertNoError<SegmentRow>(
        supabase.from("segments").select("id, name").then(),
        "segments",
      ),
      assertNoError<ClientDbRow>(
        supabase.from("clients").select("id, name, segment_id").order("created_at", { ascending: false }).then(),
        "clients",
      ),
      assertNoError<LoanDbRow>(
        supabase
          .from("loans")
          .select("id, client_id, principal, rate, term_months, status")
          .order("created_at", { ascending: false })
          .then(),
        "loans",
      ),
      assertNoError<PaymentDbRow>(
        supabase
          .from("payments")
          .select("loan_id, due_date, amount_due, amount_paid, paid_at, status, created_at")
          .order("created_at", { ascending: false })
          .then(),
        "payments",
      ),
    ])

  // Build highlight cards from calculated values
  const highlightCards: DashboardHighlight[] = [
    {
      title: 'Monto prestado',
      value: formatCurrencyCompact(totalLent[0]?.total || 0),
      description: 'Suma de todos los préstamos activos',
      icon: 'piggy_bank',
    },
    {
      title: 'Vencido sin cobrar',
      value: formatCurrencyCompact(totalOverdue[0]?.total || 0),
      description: 'Pagos que no se recibieron a tiempo',
      icon: 'badge_dollar_sign',
    },
    {
      title: 'Total de clientes',
      value: String(totalClients[0]?.count || 0),
      description: 'Clientes con préstamos activos',
      icon: 'users',
    },
    {
      title: 'Clientes atrasados',
      value: String(lateClients[0]?.count || 0),
      description: 'Clientes que tienen pagos pendientes',
      icon: 'clock',
    },
  ]

  const performanceSeries: PortfolioPoint[] = performance.map((row) => ({
    month: row.month,
    prestado: Number(row.prestado ?? 0),
    cobrado: Number(row.cobrado ?? 0),
  }))

  const portfolioMetrics: PortfolioMetric[] = metrics.map((row) => {
    const toneClasses = mapToneToClasses(row.tone)
    return {
      label: row.label,
      value: row.value,
      helper: row.helper ?? "",
      progress: Number(row.progress ?? 0),
      helperClassName: toneClasses.helperClassName,
      progressClassName: toneClasses.progressClassName,
    }
  })

  // Map segments for easy lookup
  const segmentMap = new Map(segments.map((s) => [s.id, s.name]))

  // Build helper maps
  const loansByClient = loans.reduce<Record<string, LoanDbRow[]>>((acc, loan) => {
    acc[loan.client_id] = acc[loan.client_id] || []
    acc[loan.client_id].push(loan)
    return acc
  }, {})

  const paymentsByLoan = payments.reduce<Record<string, PaymentDbRow[]>>((acc, payment) => {
    acc[payment.loan_id] = acc[payment.loan_id] || []
    acc[payment.loan_id].push(payment)
    return acc
  }, {})

  const clientRows: ClientRow[] = clients.map((client) => {
    const clientLoans = loansByClient[client.id] || []
    const balance = clientLoans.reduce((sum, loan) => sum + (loan.principal ?? 0), 0)

    const hasLatePayments = clientLoans.some((loan) =>
      (paymentsByLoan[loan.id] || []).some((p) => p.status === "mora" || p.status === "vencido"),
    )

    const statusText = hasLatePayments ? "Atraso" : "Al día"
    const riskText = hasLatePayments ? "Alerta" : "Estable"

    return {
      name: client.name,
      segment: segmentMap.get(client.segment_id ?? -1) ?? "",
      status: statusText,
      balance: formatCurrency(balance),
      risk: riskText,
    }
  })

  const loanRows: LoanRow[] = loans.map((loan) => ({
    id: loan.id,
    client: clients.find((c) => c.id === loan.client_id)?.name ?? "",
    amount: formatCurrency(loan.principal),
    rate: formatPercent(loan.rate, 1),
    term: `${loan.term_months} meses`,
    status: loan.status,
  }))

  const notificationItems: NotificationItem[] = payments
    .filter((p) => p.status !== "pagado")
    .map((p) => {
      const loan = loans.find((l) => l.id === p.loan_id)
      const clientName = clients.find((c) => c.id === loan?.client_id)?.name ?? ""
      const title = p.status === "mora" || p.status === "vencido" ? "Pago vencido" : "Pago pendiente"
      const dueText = p.due_date ? `Vence ${p.due_date}` : null
      const amountText = formatCurrency(p.amount_due)
      const detail = [dueText, amountText].filter(Boolean).join(" · ")

      return {
        title,
        client: clientName,
        detail,
      }
    })

  return {
    highlights: highlightCards,
    performance: performanceSeries,
    metrics: portfolioMetrics,
    operations: null,
    clients: clientRows,
    loans: loanRows,
    notifications: notificationItems,
  }
}
