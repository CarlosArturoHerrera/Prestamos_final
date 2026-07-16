import {
  CardGridSkeleton,
  TableSkeleton,
} from "@/components/shared/data-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton de grupo para todas las rutas del dashboard.
 * Se muestra al instante mientras el layout resuelve la sesión en el
 * servidor y el cliente descarga el chunk de la página destino.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <CardGridSkeleton count={4} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
