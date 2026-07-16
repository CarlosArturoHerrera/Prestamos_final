import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 rounded-xl border border-border h-10 px-3.5 py-2 text-base md:text-sm",
        "bg-input text-foreground placeholder:text-muted-foreground",
        "dark:bg-input dark:text-foreground dark:placeholder:text-muted-foreground",
        "shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35),0_1px_0_rgba(255,255,255,0.04)_inset]",
        "transition-[border-color,box-shadow,background-color] duration-[150ms] outline-none",
        "hover:border-primary/50 dark:hover:border-primary/60",
        "focus-visible:border-ring/60 focus-visible:ring-[3px] focus-visible:ring-ring/20 dark:focus-visible:border-[#60A5FA] dark:focus-visible:ring-primary/30",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
