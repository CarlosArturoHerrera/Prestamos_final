import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        /* base */
        "w-full min-w-0 rounded-xl border border-border h-10 px-3.5 py-2 text-base md:text-sm",
        /* colores: blanco en light, índigo oscuro en dark */
        "bg-white text-foreground placeholder:text-muted-foreground",
        "dark:bg-surface dark:text-foreground dark:placeholder:text-muted-foreground",
        /* sombra interna sutil */
        "shadow-[0_1px_3px_rgba(79,70,229,0.06)]",
        /* transiciones */
        "transition-[border-color,box-shadow,background-color] outline-none",
        /* focus */
        "focus-visible:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-primary/20",
        /* file input */
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        /* disabled */
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
        /* validación */
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
