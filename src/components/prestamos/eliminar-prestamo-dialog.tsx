"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchApi, redirectToLoginIfUnauthorized } from "@/lib/fetch-api";

interface EliminarPrestamoDialogProps {
  /** Préstamo a eliminar; `null` mantiene la isla cerrada. */
  prestamoId: number | null;
  onOpenChange: (abierto: boolean) => void;
  /** Se ejecuta sólo tras un borrado correcto, para refrescar el listado. */
  onEliminado: () => void;
}

/**
 * Confirmación de borrado de un préstamo. La eliminación sólo se dispara tras
 * la confirmación explícita del usuario; «Cancelar» cierra sin tocar nada.
 *
 * El diálogo es el mismo que usan el resto de borrados del proyecto, así que no
 * introduce lenguaje visual nuevo.
 */
export function EliminarPrestamoDialog({
  prestamoId,
  onOpenChange,
  onEliminado,
}: EliminarPrestamoDialogProps) {
  const [eliminando, setEliminando] = useState(false);

  const eliminar = async () => {
    // Guard frente a dobles clics o a un Enter repetido sobre «Aceptar».
    if (prestamoId === null || eliminando) return;

    setEliminando(true);
    const res = await fetchApi(`/api/prestamos/${prestamoId}`, {
      method: "DELETE",
    });
    setEliminando(false);

    if (!res.ok) {
      redirectToLoginIfUnauthorized(res.status);
      toast.error(res.message);
      return;
    }

    toast.success("Préstamo eliminado");
    onOpenChange(false);
    onEliminado();
  };

  return (
    <AlertDialog
      open={prestamoId !== null}
      onOpenChange={(abierto) => {
        // Cerrar a media petición dejaría el estado de carga colgado.
        if (eliminando) return;
        onOpenChange(abierto);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar préstamo?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción eliminará el préstamo y no se puede deshacer. ¿Deseas
            continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // El componente cierra el diálogo por defecto al pulsar; hay que
              // evitarlo para poder mostrar el estado de carga.
              e.preventDefault();
              void eliminar();
            }}
            disabled={eliminando}
          >
            {eliminando ? "Eliminando..." : "Aceptar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
