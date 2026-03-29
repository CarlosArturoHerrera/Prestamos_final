import { supabase } from "./supabase"

// Tipos para las respuestas de la BD
interface Client {
  id: string
  name: string
  segment_id?: number
  cedula?: string
  telefono?: string
}

interface Loan {
  id: string
  client_id: string
  principal: number
  status: string
  monto?: number
  estado?: string
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
export async function getClientByCedula(cedula: string): Promise<Client | null> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, segment_id, cedula, telefono")
      .eq("cedula", cedula)
      .single()

    if (error) throw error
    return data || null
  } catch (error) {
    console.error("Error getting client by cedula:", error)
    return null
  }
}

export async function getLoanAbonos(loanId: string) {
  try {
    const { data, error } = await supabase
      .from("abonos")
      .select("id, fecha_abono, total_pagado, monto_capital_debitado, interes_cobrado, saldo_capital_restante, observaciones")
      .eq("prestamo_id", loanId)
      .order("fecha_abono", { ascending: false })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting loan abonos:", error)
    return []
  }
}

export async function getLoanReganches(loanId: string) {
  try {
    const { data, error } = await supabase
      .from("reganches")
      .select("id, monto_agregado, notas, created_at")
      .eq("prestamo_id", loanId)
      .order("created_at", { ascending: true })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting loan reganches:", error)
    return []
  }
}

export async function getLoanIntereses(loanId: string) {
  try {
    const { data, error } = await supabase
      .from("intereses_atrasados")
      .select("id, fecha_generado, monto, aplicado, fecha_aplicado")
      .eq("prestamo_id", loanId)
      .order("fecha_generado", { ascending: true })
      .limit(20)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error("Error getting loan intereses:", error)
    return []
  }
}

export async function buildAIContext(userMessage?: string): Promise<string> {
  try {
    const summary = await getPortfolioSummary()
    const overdueLoans = await getOverdueLoans()

    let context = `\n## Resumen del Portafolio:\n- Total de Clientes: ${summary.total_clients}\n- Total de Préstamos Activos: ${summary.total_loans}\n- Valor Total del Portafolio: $${summary.total_portfolio_value.toFixed(2)}\n- Tasa de Interés Promedio: ${summary.average_interest_rate.toFixed(2)}%\n- Préstamos en Mora: ${summary.overdue_loans}\n- Préstamos en Riesgo: ${summary.at_risk_loans}\n\n## Préstamos Vencidos Recientes:\n${overdueLoans
      .map((loan) => `- Cliente ID: ${loan.client_id}, Monto: $${loan.principal}`)
      .join("\n")}
`;

    // Si hay un mensaje del usuario, intentar extraer identificadores y enriquecer contexto
    if (userMessage) {
      const cedulaMatch = userMessage.match(/\b\d{6,}\b/)
      const phoneMatch = userMessage.match(/\+?\d{7,15}/)
      const wantsHistory = /historial|abonos|pagos/i.test(userMessage)
      const wantsSaldo = /saldo|debo|cuánto debo|capital pendiente|cuanto debo/i.test(userMessage)
      const wantsReganches = /reganch/i.test(userMessage)
      const wantsIntereses = /interes|intereses|atrasado/i.test(userMessage)

      if (cedulaMatch) {
        const cedula = cedulaMatch[0]
        const client = await getClientByCedula(cedula)
        if (client) {
          context += `\n## Cliente encontrado: ${client.name} (ID: ${client.id}, Cédula: ${client.cedula}, Tel: ${client.telefono})\n`
          const loans = await getClientLoans(client.id)
          if (loans && loans.length > 0) {
            context += `\n## Préstamos del cliente:\n${loans
              .map((l) => `- ID: ${l.id}, Monto: $${l.principal || l.monto || 0}, Estado: ${l.status || l.estado || "-"}`)
              .join("\n")}`

            // Si el usuario pide historial o intereses/reganches, obtener detalles del primer préstamo
            const firstLoan = loans[0]
            if (wantsHistory) {
              const abonos = await getLoanAbonos(firstLoan.id)
              context += `\n## Últimos abonos (muestra):\n${abonos
                .slice(0, 5)
                .map((a: any) => `- ${a.fecha_abono}: $${a.total_pagado} (capital: $${a.monto_capital_debitado})`)
                .join("\n")}`
            }
            if (wantsReganches) {
              const reganches = await getLoanReganches(firstLoan.id)
              context += `\n## Reganches:\n${reganches.map((r: any) => `- ${r.created_at}: +$${r.monto_agregado} (${r.notas || ""})`).join("\n")}`
            }
            if (wantsIntereses || wantsSaldo) {
              const intereses = await getLoanIntereses(firstLoan.id)
              context += `\n## Intereses atrasados:\n${intereses.map((i: any) => `- ${i.fecha_generado}: $${i.monto} (aplicado: ${i.aplicado})`).join("\n")}`
            }
          }
        } else {
          context += `\n## Identificador buscado: Cédula ${cedula} — no encontrado en la base de datos.\n`
        }
      }
    }

    return context
  } catch (error) {
    console.error("Error building AI context:", error)
    return ""
  }
}
