"use client"

import { CalendarIcon } from "lucide-react"
import { format, parseISO } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type BaseProps = {
  className?: string
  placeholder?: string
}

type SingleProps = BaseProps & {
  mode?: "single"
  value?: string
  onChange: (value: string) => void
}

type RangeProps = BaseProps & {
  mode: "range"
  range?: { from?: string; to?: string }
  onRangeChange: (range: { from?: string; to?: string }) => void
}

function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

function fromISODate(value?: string): Date | undefined {
  if (!value) return undefined
  try {
    // Forzamos zona local para evitar desfases en cliente.
    return toZonedTime(parseISO(`${value}T00:00:00`), Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return undefined
  }
}

export function CalendarDatePicker(props: SingleProps | RangeProps) {
  if (props.mode === "range") {
    const from = fromISODate(props.range?.from)
    const to = fromISODate(props.range?.to)
    const label =
      from && to
        ? `${format(from, "dd/MM/yyyy")} - ${format(to, "dd/MM/yyyy")}`
        : props.placeholder ?? "Seleccionar rango"

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start text-left font-normal", props.className)}>
            <CalendarIcon className="mr-2 size-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={{ from, to } as DateRange}
            onSelect={(range) =>
              props.onRangeChange({
                from: range?.from ? toISODate(range.from) : undefined,
                to: range?.to ? toISODate(range.to) : undefined,
              })
            }
          />
        </PopoverContent>
      </Popover>
    )
  }

  const date = fromISODate(props.value)
  const label = date ? format(date, "dd/MM/yyyy") : props.placeholder ?? "Seleccionar fecha"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", props.className)}>
          <CalendarIcon className="mr-2 size-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (!d) return
            props.onChange(toISODate(d))
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
