import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap [&>svg]:size-3 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow,background-color]",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/12 text-primary [a&]:hover:bg-primary/18",
        secondary:
          "border-secondary/20 bg-secondary/18 text-secondary-foreground [a&]:hover:bg-secondary/24",
        destructive:
          "border-destructive/20 bg-destructive/12 text-destructive [a&]:hover:bg-destructive/16 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20",
        outline:
          "border-border bg-surface/70 text-foreground [a&]:hover:bg-accent/70 [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
