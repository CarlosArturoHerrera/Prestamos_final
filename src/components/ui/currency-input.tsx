"use client";

import { useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { maskCurrencyInput, unformatCurrency } from "@/lib/currency-input";
import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<typeof Input>;

type CurrencyInputProps = Omit<InputProps, "onChange" | "value" | "type"> & {
  /** Raw (unformatted) numeric string, e.g. "1000000" or "1000.50" */
  value: string;
  /** Called with the raw (unformatted) value after each keystroke */
  onChange: (rawValue: string) => void;
};

/**
 * A text input that live-formats currency with thousands separators.
 *
 * - Displays:  "1,000,000"
 * - Calls onChange with raw value: "1000000"
 * - Handles paste of "RD$1,000,000" → normalizes to "1,000,000"
 * - Maintains cursor position through formatting changes
 *
 * Usage:
 *   <CurrencyInput value={rawValue} onChange={(raw) => setRawValue(raw)} />
 */
export function CurrencyInput({
  value,
  onChange,
  className,
  ...props
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawInput = input.value;
      const cursorPos = input.selectionStart ?? rawInput.length;

      // Count digits + decimal points before cursor to track position through formatting
      const beforeCursor = rawInput.slice(0, cursorPos);
      const digitsBeforeCursor = beforeCursor.replace(/[^\d.]/g, "").length;

      // Parse and reformat
      const raw = unformatCurrency(rawInput);
      const formatted = maskCurrencyInput(raw);

      // Notify parent with raw (unformatted) value
      onChange(raw);

      // Restore cursor position after React's next render
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;

        let digitCount = 0;
        let newPos = 0;

        if (digitsBeforeCursor > 0) {
          for (let i = 0; i < formatted.length; i++) {
            if (/[\d.]/.test(formatted[i])) digitCount++;
            if (digitCount >= digitsBeforeCursor) {
              newPos = i + 1;
              break;
            }
          }
          // Cursor past all digits → end of string
          if (digitCount < digitsBeforeCursor) newPos = formatted.length;
        }

        el.setSelectionRange(newPos, newPos);
      });
    },
    [onChange],
  );

  const displayValue = value ? maskCurrencyInput(value) : "";

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      className={cn("tabular-nums", className)}
    />
  );
}
