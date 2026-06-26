"use client"

import { useLayoutEffect, useRef, type ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { maskPhone, unformatPhone } from "@/lib/formatters"

type BaseInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">

export interface PhoneInputProps extends BaseInputProps {
  /** Raw digits (no formatting). e.g. "8094322344" */
  value: string
  /** Called with raw digits after each keystroke. */
  onChange: (raw: string) => void
}

/**
 * Controlled input that displays Dominican phone numbers as "809-432-2344"
 * while keeping raw digits in state.
 * Handles paste, backspace, and cursor position correctly.
 */
export function PhoneInput({ value, onChange, placeholder = "809-432-2344", ...props }: PhoneInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<number | null>(null)

  // Restore cursor after React re-renders the controlled input value.
  useLayoutEffect(() => {
    if (cursorRef.current !== null && ref.current && ref.current === document.activeElement) {
      ref.current.setSelectionRange(cursorRef.current, cursorRef.current)
    }
    cursorRef.current = null
  })

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value
    const cursor = e.target.selectionStart ?? inputVal.length

    // Count digits before cursor to restore position after formatting.
    const digitsBeforeCursor = inputVal.slice(0, cursor).replace(/\D/g, "").length

    const raw = unformatPhone(inputVal)
    const formatted = maskPhone(raw)

    // Find the new cursor position in the formatted string.
    let d = 0
    let newCursor = formatted.length
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) {
        d++
        if (d === digitsBeforeCursor) {
          newCursor = i + 1
          break
        }
      }
    }

    cursorRef.current = newCursor
    onChange(raw)
  }

  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="numeric"
      value={maskPhone(value)}
      onChange={handleChange}
      placeholder={placeholder}
      {...props}
    />
  )
}
