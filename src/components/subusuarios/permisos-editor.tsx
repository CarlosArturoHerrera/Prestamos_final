"use client";

import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  MODULE_LABELS,
  type PermissionCode,
  type PermissionModule,
  permissionsByModule,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * Editor de permisos de un subusuario (§14, §20).
 *
 * Agrupa por módulo y permite marcar/desmarcar el grupo entero. El estado vive
 * en el componente padre: aquí sólo se pinta y se notifican los cambios.
 *
 * Es un formulario, no un control de seguridad. Lo que decide de verdad es
 * `user_permissions` + `has_permission()` en la base de datos.
 */

type Props = {
  seleccionados: PermissionCode[];
  onChange: (permisos: PermissionCode[]) => void;
  disabled?: boolean;
};

const GRUPOS = permissionsByModule();

export function PermisosEditor({ seleccionados, onChange, disabled }: Props) {
  const activos = new Set(seleccionados);

  const alternar = (code: PermissionCode) => {
    const siguiente = new Set(activos);
    if (siguiente.has(code)) siguiente.delete(code);
    else siguiente.add(code);
    onChange([...siguiente]);
  };

  const alternarModulo = (modulo: PermissionModule) => {
    const delModulo = GRUPOS[modulo].map((p) => p.code);
    const todosPuestos = delModulo.every((c) => activos.has(c));
    const siguiente = new Set(activos);
    for (const c of delModulo) {
      if (todosPuestos) siguiente.delete(c);
      else siguiente.add(c);
    }
    onChange([...siguiente]);
  };

  const modulos = (Object.keys(GRUPOS) as PermissionModule[]).filter(
    (m) => GRUPOS[m].length > 0,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Permisos
          <Badge variant="secondary" className="ml-2 font-normal">
            {seleccionados.length} activo{seleccionados.length === 1 ? "" : "s"}
          </Badge>
        </p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={() =>
              onChange(modulos.flatMap((m) => GRUPOS[m].map((p) => p.code)))
            }
          >
            <Check className="size-3" />
            Todos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            <Minus className="size-3" />
            Ninguno
          </Button>
        </div>
      </div>

      <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {modulos.map((modulo) => {
          const permisos = GRUPOS[modulo];
          const puestos = permisos.filter((p) => activos.has(p.code)).length;
          const todos = puestos === permisos.length;

          return (
            <div key={modulo} className="rounded-md bg-muted/40 p-2.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => alternarModulo(modulo)}
                className={cn(
                  "mb-2 flex w-full items-center justify-between rounded text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                  todos ? "text-primary" : "text-muted-foreground",
                  !disabled && "hover:text-foreground",
                )}
              >
                <span>{MODULE_LABELS[modulo]}</span>
                <span className="font-normal normal-case tabular-nums">
                  {puestos}/{permisos.length}
                </span>
              </button>

              <div className="grid gap-1.5 sm:grid-cols-2">
                {permisos.map((p) => (
                  <label
                    key={p.code}
                    htmlFor={`perm-${p.code}`}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                      !disabled && "cursor-pointer hover:bg-background",
                    )}
                  >
                    <Checkbox
                      id={`perm-${p.code}`}
                      checked={activos.has(p.code)}
                      disabled={disabled}
                      onCheckedChange={() => alternar(p.code)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`perm-${p.code}`}
                      className="min-w-0 cursor-pointer text-sm font-normal leading-tight text-foreground"
                    >
                      {p.label}
                    </Label>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
