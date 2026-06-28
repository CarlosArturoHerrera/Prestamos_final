"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EASE, DUR } from "@/lib/motion";

export type KpiCard = {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  /** "brand" | "emerald" | "amber" | "rose" | "accent" */
  color?: "brand" | "emerald" | "amber" | "rose" | "accent";
};

interface KpiGridProps {
  items: KpiCard[];
}

const colorMap = {
  brand: {
    icon: "bg-[#E8F0FE] border-[#0052CC]/15 text-[#0052CC] dark:bg-[rgba(0,82,204,0.12)] dark:border-[rgba(0,82,204,0.2)] dark:text-[#3385FF]",
    value: "text-[#0052CC] dark:text-[#3385FF]",
    card: "border-[#E8F0FE] dark:border-[rgba(0,82,204,0.15)]",
    glow: "",
  },
  accent: {
    icon: "bg-[rgba(0,210,255,0.10)] border-[rgba(0,210,255,0.20)] text-[#0044AA] dark:bg-[rgba(0,210,255,0.10)] dark:border-[rgba(0,210,255,0.20)] dark:text-[#00D2FF]",
    value: "text-[#0044AA] dark:text-[#00D2FF]",
    card: "border-[rgba(0,210,255,0.15)] dark:border-[rgba(0,210,255,0.12)]",
    glow: "",
  },
  emerald: {
    icon: "bg-emerald-100 border-emerald-200 text-emerald-600 dark:bg-emerald-950/60 dark:border-emerald-800/50 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    card: "border-emerald-100 dark:border-emerald-900/40",
    glow: "",
  },
  amber: {
    icon: "bg-amber-100 border-amber-200 text-amber-600 dark:bg-amber-950/60 dark:border-amber-800/50 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
    card: "border-amber-100 dark:border-amber-900/40",
    glow: "",
  },
  rose: {
    icon: "bg-rose-100 border-rose-200 text-rose-600 dark:bg-rose-950/60 dark:border-rose-800/50 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    card: "border-rose-100 dark:border-rose-900/40",
    glow: "",
  },
};

const containerVariants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.065, delayChildren: 0.04 },
  },
};

const cardVariants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DUR.slow, ease: EASE.out },
  },
};

export function KpiGrid({ items }: KpiGridProps) {
  const reduced = useReducedMotion();

  const getValueSize = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "").length;
    if (numericValue >= 7) return "text-xl";
    if (numericValue >= 5) return "text-2xl";
    return "text-3xl";
  };

  return (
    <motion.section
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      variants={containerVariants}
      initial={reduced ? false : "initial"}
      animate="animate"
    >
      {items.map((item) => {
        const colors = colorMap[item.color ?? "brand"];
        return (
          <motion.div
            key={item.title}
            variants={reduced ? undefined : cardVariants}
          >
            <Card className={cn("stat-card h-full", colors.card)}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div className="space-y-1 min-w-0">
                  <CardDescription className="text-xs font-medium">
                    {item.title}
                  </CardDescription>
                  <CardTitle
                    className={cn(
                      getValueSize(item.value),
                      "font-bold",
                      colors.value,
                    )}
                  >
                    {item.value}
                  </CardTitle>
                </div>
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                    colors.icon,
                  )}
                >
                  <item.icon className="size-5" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
