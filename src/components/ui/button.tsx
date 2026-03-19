import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary/80 bg-linear-to-r from-primary to-secondary text-primary-foreground shadow-[0_14px_30px_rgba(59,130,246,0.28)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(59,130,246,0.34)]",
        destructive:
          "border border-destructive/70 bg-destructive text-white shadow-[0_12px_26px_rgba(239,68,68,0.24)] hover:-translate-y-0.5 hover:bg-destructive/92 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-border bg-surface/80 text-foreground shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-primary/30 hover:bg-accent/70 hover:text-foreground dark:bg-surface/80",
        secondary:
          "border border-secondary/30 bg-secondary/16 text-secondary-foreground hover:-translate-y-0.5 hover:bg-secondary/22",
        ghost:
          "text-foreground/80 hover:bg-accent/80 hover:text-foreground dark:hover:bg-accent/70",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2.5 has-[>svg]:px-3.5",
        sm: "h-9 rounded-lg gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4.5",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
