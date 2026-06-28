import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-[150ms] disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,82,204,0.3)] hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,82,204,0.4)] active:translate-y-0 active:shadow-[0_1px_4px_rgba(0,82,204,0.2)]",
        destructive:
          "border border-destructive/70 bg-destructive text-white shadow-[0_4px_14px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 hover:bg-destructive/92 active:translate-y-0 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70",
        outline:
          "border border-border bg-card text-foreground shadow-sm hover:border-primary/40 hover:bg-accent/60 hover:text-foreground dark:bg-card/80",
        secondary:
          "border border-primary/20 bg-primary/10 text-primary hover:-translate-y-0.5 hover:bg-primary/16 active:translate-y-0 dark:border-primary/25 dark:bg-primary/15 dark:text-primary",
        ghost:
          "text-foreground/80 hover:bg-accent/70 hover:text-foreground dark:hover:bg-accent/50",
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
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
