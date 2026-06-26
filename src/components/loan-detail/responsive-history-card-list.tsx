"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Field definition for each row in a history card.
 * `value` is called with the full record to render the cell content.
 * `hidden` is called to conditionally skip the row (e.g., empty observations).
 */
export type CardField = {
  label: string
  value: (record: Record<string, unknown>) => ReactNode
  valueClassName?: string
  hidden?: (record: Record<string, unknown>) => boolean
}

type ResponsiveHistoryCardListProps = {
  records: Record<string, unknown>[]
  fields: CardField[]
  /** Derive a stable key for each row. Defaults to record.id or index. */
  rowKey?: (record: Record<string, unknown>, idx: number) => string
  /** Optional action buttons rendered below the fields for each row. */
  actions?: (record: Record<string, unknown>, idx: number) => ReactNode
  className?: string
}

/**
 * Mobile card list (hidden at md+).
 * Renders each record as a labeled key→value card.
 * The companion desktop table should be wrapped in `hidden md:block`.
 */
export function ResponsiveHistoryCardList({
  records,
  fields,
  rowKey,
  actions,
  className,
}: ResponsiveHistoryCardListProps) {
  if (records.length === 0) return null

  return (
    <ul className={cn("divide-y divide-border/60 md:hidden", className)}>
      {records.map((record, idx) => {
        const key =
          rowKey?.(record, idx) ??
          (record.id != null ? String(record.id) : `row-${idx}`)

        const visibleFields = fields.filter((f) => !f.hidden?.(record))
        const actionContent = actions?.(record, idx)

        return (
          <li key={key} className="space-y-2.5 p-4">
            {visibleFields.map((field) => (
              <div
                key={field.label}
                className="flex items-start justify-between gap-3"
              >
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {field.label}
                </span>
                <span
                  className={cn(
                    "min-w-0 break-words text-right text-sm",
                    field.valueClassName,
                  )}
                >
                  {field.value(record)}
                </span>
              </div>
            ))}
            {actionContent != null && (
              <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2.5">
                {actionContent}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
