import { Button } from "@/components/ui/button"

interface QuickPromptsProps {
  prompts: string[]
  onSelectPrompt: (prompt: string) => void
  disabled?: boolean
  show?: boolean
}

export function QuickPrompts({
  prompts,
  onSelectPrompt,
  disabled = false,
  show = true,
}: QuickPromptsProps) {
  if (!show) return null

  return (
    <div className="grid grid-cols-1 gap-2">
      {prompts.map((prompt) => (
        <Button
          key={prompt}
          variant="outline"
          size="sm"
          onClick={() => onSelectPrompt(prompt)}
          className="text-xs h-auto py-2 text-left justify-start"
          disabled={disabled}
        >
          {prompt}
        </Button>
      ))}
    </div>
  )
}
