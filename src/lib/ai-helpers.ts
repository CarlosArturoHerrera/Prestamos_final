import { supabase } from "@/lib/supabase"

// Tipos para las respuestas de la BD
interface Client {
  id: string
  name: string
  segment_id?: number
}

interface Loan {
  id: string
  client_id: string
  principal: number
  status: string
}

interface PortfolioSummary {
  total_clients: number
  total_loans: number
  total_portfolio_value: number
  average_interest_rate: number
  overdue_loans: number
  at_risk_loans: number
}

// Obtener resumen del portafolio
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  try {
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("principal, rate, status")

    if (loansError) throw loansError

    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id")

    if (clientsError) throw clientsError

    const totalPortfolioValue = loans?.reduce((sum, loan) => sum + (loan.principal || 0), 0) || 0
    const avgInterestRate =
      loans && loans.length > 0
        ? loans.reduce((sum, loan) => sum + (loan.rate || 0), 0) / loans.length
        : 0

    const overdueLoans = loans?.filter((loan) => loan.status === "mora").length || 0
    const atRiskLoans = loans?.filter((loan) => loan.status === "vencido").length || 0

    return {
      total_clients: clients?.length || 0,
      total_loans: loans?.length || 0,
      total_portfolio_value: totalPortfolioValue,
      average_interest_rate: avgInterestRate,
      overdue_loans: overdueLoans,
      at_risk_loans: atRiskLoans,
    }
  } catch (error) {
    console.error("Error getting portfolio summary:", error)
    return {
      total_clients: 0,
      total_loans: 0,
      total_portfolio_value: 0,
      average_interest_rate: 0,
      overdue_loans: 0,
      at_risk_loans: 0,
    }
  }
}

// Obtener clientes activos
export async function getActiveClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, segment_id")
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting active clients:", error)
    return []
  }
}

// Obtener préstamos vencidos
export async function getOverdueLoans(): Promise<Loan[]> {
  try {
    const { data, error } = await supabase
      .from("loans")
      .select("id, client_id, principal, status")
      .eq("status", "mora")
      .limit(10)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting overdue loans:", error)
    return []
  }
}

// Obtener información de un cliente específico
export async function getClientDetails(clientId: string): Promise<Client | null> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, segment_id")
      .eq("id", clientId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error("Error getting client details:", error)
    return null
  }
}

// Obtener préstamos de un cliente
export async function getClientLoans(clientId: string): Promise<Loan[]> {
  try {
    const { data, error } = await supabase
      .from("loans")
      .select("id, client_id, principal, status")
      .eq("client_id", clientId)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting client loans:", error)
    return []
  }
}

// Buscar clientes por nombre
export async function searchClients(query: string): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, segment_id")
      .ilike("name", `%${query}%`)
      .limit(5)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error searching clients:", error)
    return []
  }
}

// Contexto para el sistema de IA
export async function buildAIContext(): Promise<string> {
  try {
    const summary = await getPortfolioSummary()
    const overdueLoans = await getOverdueLoans()

    let context = `
## Resumen del Portafolio:
- Total de Clientes: ${summary.total_clients}
- Total de Préstamos Activos: ${summary.total_loans}
- Valor Total del Portafolio: $${summary.total_portfolio_value.toFixed(2)}
- Tasa de Interés Promedio: ${summary.average_interest_rate.toFixed(2)}%
- Préstamos en Mora: ${summary.overdue_loans}
- Préstamos en Riesgo: ${summary.at_risk_loans}

## Préstamos Vencidos Recientes:
${overdueLoans
  .map((loan) => `- Cliente ID: ${loan.client_id}, Monto: $${loan.principal}`)
  .join("\n")}
`

    return context
  } catch (error) {
    console.error("Error building AI context:", error)
    return ""
  }
}
