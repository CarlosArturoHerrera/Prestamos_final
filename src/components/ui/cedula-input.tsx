"use client"

import { useLayoutEffect, useRef, type ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { maskCedula, unformatCedula } from "@/lib/formatters"

type BaseInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange">

export interface CedulaInputProps extends BaseInputProps {
  /** Raw digits (no formatting). e.g. "40230620904" */
  value: string
  /** Called with raw digits after each keystroke. */
  onChange: (raw: string) => void
}

/**
 * Controlled input that displays Dominican cedulas as "402-3062090-4"
 * while keeping raw digits in state.
 * Handles paste, backspace, and cursor position correctly.
 */
export function CedulaInput({ value, onChange, placeholder = "402-3062090-4", ...props }: CedulaInputProps) {
  const ref = useRef<HTMLInputElement>(null)
  const cursorRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (cursorRef.current !== null && ref.current && ref.current === document.activeElement) {
      ref.current.setSelectionRange(cursorRef.current, cursorRef.current)
    }
    cursorRef.current = null
  })

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value
    const cursor = e.target.selectionStart ?? inputVal.length

    const digitsBeforeCursor = inputVal.slice(0, cursor).replace(/\D/g, "").length

    const raw = unformatCedula(inputVal)
    const formatted = maskCedula(raw)

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
      inputMode="numeric"
      value={maskCedula(value)}
      onChange={handleChange}
      placeholder={placeholder}
      {...props}
    />
  )
}
