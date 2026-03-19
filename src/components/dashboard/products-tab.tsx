"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ProductsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Productos</h2>
        <p className="text-muted-foreground mt-2">
          Gestiona tus productos de crédito y servicios
        </p>
      </div>

      <Card className="bg-card/80 backdrop-blur animate-in fade-in slide-in-from-bottom-6 duration-700">
        <CardHeader className="flex items-start justify-between sm:flex-row">
          <div>
            <CardTitle>Productos de crédito</CardTitle>
            <CardDescription>
              Crear, editar y gestionar los productos que ofreces
            </CardDescription>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Aquí se mostrarán tus productos de crédito
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
