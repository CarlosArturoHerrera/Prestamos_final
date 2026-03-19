import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-10 w-full min-w-0 rounded-xl border bg-surface/75 px-3.5 py-2 text-base shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_24px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/60 md:text-sm",
        "focus-visible:border-primary/50 focus-visible:bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/35",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
