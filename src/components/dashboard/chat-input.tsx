import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Tu pregunta...",
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue)
      setInputValue("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2">
      <input
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        className="flex-1 px-3 py-2 rounded-md border border-sidebar-border bg-sidebar text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        disabled={disabled}
      />
      <Button
        onClick={handleSend}
        disabled={!inputValue.trim() || disabled}
        size="sm"
        className="px-3"
        title="Enviar mensaje"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  )
}
