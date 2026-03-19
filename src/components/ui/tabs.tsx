"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-12 w-fit items-center justify-center rounded-2xl border border-border/80 bg-surface/80 p-1 text-muted-foreground shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "text-foreground/76 inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap transition-[color,box-shadow,background-color,transform] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary/20 data-[state=active]:bg-linear-to-r data-[state=active]:from-primary/10 data-[state=active]:to-secondary/14 data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_24px_rgba(59,130,246,0.12)] data-[state=active]:-translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
