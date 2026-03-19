export interface Client {
  id: string
  name: string
  email: string
  phone: string
  segment: string
  status: string
  riskLevel: "Estable" | "Vigilancia" | "Alerta" | "Crítico"
  joinDate: string
  lastPayment: string
  notes?: string
  location: string
}
