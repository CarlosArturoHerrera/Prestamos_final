import { Button } from "@/components/ui/button"
import { Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
  onTTS?: (text: string) => void
  showTTS?: boolean
}

export function ChatMessage({ message, onTTS, showTTS = false }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-2",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-xs px-3 py-2 rounded-lg text-sm wrap-break-word",
          message.role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-sidebar-accent text-sidebar-foreground"
        )}
      >
        <p>{message.content}</p>
        <span className="text-xs opacity-70 mt-1 block">
          {message.timestamp.toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {message.role === "assistant" && onTTS && showTTS && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTTS(message.content)}
          className="h-auto p-1 self-end mb-1"
          title="Leer mensaje"
        >
          <Volume2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
