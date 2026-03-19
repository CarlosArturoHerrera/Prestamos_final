"use client"

import TextareaAutosize from "react-textarea-autosize"
import { cn } from "@/lib/utils"

export interface TextareaAutosizeProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number
  maxRows?: number
}

const TextareaAutosizeComponent = TextareaAutosize

export { TextareaAutosizeComponent as TextareaAutosize }
