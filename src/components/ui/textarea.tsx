import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border placeholder:text-muted-foreground hover:border-primary/50 focus-visible:border-primary/50 focus-visible:ring-ring/35 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-2xl border bg-surface/80 px-3.5 py-3 text-base shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_10px_24px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input dark:hover:border-primary/60 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.04)_inset] dark:focus-visible:border-[#60A5FA] dark:focus-visible:ring-primary/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
