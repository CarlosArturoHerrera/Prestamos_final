"use client"

import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { BadgeDollarSign, Clock3, PiggyBank, Users } from "lucide-react"
import { fetchDashboardData } from "@/actions/dashboard"
import { HeroSection } from "@/components/dashboard/hero-section"
import { KpiGrid } from "@/components/dashboard/kpi-grid"
import { PortfolioChartCard } from "@/components/dashboard/portfolio-chart-card"
import type { ChartConfig } from "@/components/ui/chart"
import { toast } from "sonner"

const chartConfig: ChartConfig = {
	prestado: {
		label: "Dinero prestado",
		color: "oklch(0.47 0.1 204.5)",
	},
	cobrado: {
		label: "Dinero cobrado",
		color: "oklch(0.64 0.2 29)",
	},
} as const

const highlightIcons = {
	piggy_bank: PiggyBank,
	badge_dollar_sign: BadgeDollarSign,
	clock: Clock3,
	users: Users,
}

export function DashboardTab() {
	const router = useRouter()
	const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboardData>> | null>(null)

	useEffect(() => {
		fetchDashboardData().then(setData)
	}, [])

	const handleLogout = async () => {
		try {
			await signOut({ redirect: false })
			toast.success("Sesión cerrada correctamente")
			router.push("/login")
		} catch (error) {
			toast.error("Error al cerrar sesión")
		}
	}

	if (!data) {
		return <div className="surface-panel rounded-3xl px-6 py-10 text-sm text-muted-foreground">Cargando panel...</div>
	}

	const { highlights, performance, metrics } = data

	const highlightCards = highlights.map((item) => ({
		...item,
		icon: highlightIcons[item.icon as keyof typeof highlightIcons] ?? PiggyBank,
	}))

	return (
		<>
			<HeroSection
				title="Préstamos"
				subtitle="Monto prestado, pagos recibidos y clientes atrasados."
				highlightBadges={[
					"Préstamos activos",
					"Pagos pendientes",
					"Clientes al día",
				]}
				onLogout={handleLogout}
			/>

			<KpiGrid items={highlightCards} />


			<section className="grid gap-6 lg:grid-cols-1">
				<PortfolioChartCard
					data={performance}
					chartConfig={chartConfig}
					metrics={metrics}
				/>
			</section>
		</>
	)
}

