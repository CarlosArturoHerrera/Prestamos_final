
"use client"

import { useState, useRef, useEffect, CSSProperties, FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TextareaAutosize } from "@/components/ui/textarea-autosize"
import { 
  Zap, Mic, MicOff, Sparkles, Volume2, VolumeX, X, Send,
  BarChart3, AlertCircle, DollarSign, Users, Loader2, Trash2
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BarVisualizer } from "@/components/ui/bar-visualizer"

interface ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  createdAt?: Date
}

const CHAT_SESSION_KEY = "ai_chat_session"

export function AIChatSidebar() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [audioStream, setAudioStream] = useState<MediaStream | undefined>(undefined)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Auto-scroll cuando los mensajes cambien
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Cargar mensajes desde sessionStorage al inicializar
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(CHAT_SESSION_KEY)
      if (savedMessages) {
        const parsedMessages: ChatMessage[] = JSON.parse(savedMessages)
        setMessages(parsedMessages)
      }
    } catch (error) {
      console.error("Error loading messages from sessionStorage:", error)
    }
  }, [])

  // Guardar mensajes en sessionStorage cuando cambien
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(messages))
    } catch (error) {
      console.error("Error saving messages to sessionStorage:", error)
    }
  }, [messages])

  // Función para hacer scroll al final
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 0)
  }

  // Manejar envío de formulario
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      createdAt: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      })

      if (!response.ok) throw new Error("Failed to get response")

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ""
      const messageId = (Date.now() + 1).toString()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value)
          assistantMessage += text

          setMessages((prev) => {
            const existing = prev.find((m) => m.id === messageId)
            if (existing) {
              return prev.map((m) =>
                m.id === messageId
                  ? { ...m, content: assistantMessage }
                  : m
              )
            }
            return [
              ...prev,
              {
                id: messageId,
                content: assistantMessage,
                role: "assistant",
                createdAt: new Date(),
              },
            ]
          })
        }
      }
    } catch (error) {
      console.error("Error:", error)
      toast.error("Error al procesar tu mensaje. Intenta de nuevo.")
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content:
          "Lo siento, hubo un error al procesar tu mensaje. Intenta de nuevo.",
        role: "assistant",
        createdAt: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Función para reproducir respuesta de IA con voz (Web Speech API nativa)
  const handleSpeakMessage = (messageId: string, content: string) => {
    if (playingMessageId === messageId) {
      // Detener si ya se está reproduciendo
      speechSynthesis.cancel()
      setPlayingMessageId(null)
      setIsSpeaking(false)
      return
    }

    setPlayingMessageId(messageId)
    setIsSpeaking(true)

    try {
      // Extraer solo texto limpio sin markdown
      const cleanText = content
        .replace(/#+\s/g, "") // Remover headers
        .replace(/[*_]{1,2}(.*?)[*_]{1,2}/g, "$1") // Remover bold/italic
        .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remover links
        .replace(/`{1,3}.*?`{1,3}/g, "") // Remover code blocks

      // Usar Web Speech API nativa (gratis, sin API key)
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = "es-ES"
      utterance.rate = 0.95
      utterance.pitch = 1.0

      utterance.onend = () => {
        setPlayingMessageId(null)
        setIsSpeaking(false)
      }

      utterance.onerror = (event) => {
        console.error("Error en speech synthesis:", event)
        toast.error("Error al reproducir el audio")
        setPlayingMessageId(null)
        setIsSpeaking(false)
      }

      speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("Error in handleSpeakMessage:", error)
      toast.error("Error al reproducir el audio")
      setPlayingMessageId(null)
      setIsSpeaking(false)
    }
  }

  // Speech-to-Text: Escuchar al usuario y convertir a texto
  const handleVoiceInput = async () => {
    if (isListening) {
      // Detener grabación
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop()
      }
      setAudioStream(undefined)
      return
    }

    try {
      // Solicitar permiso de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioStream(stream)

      // Configurar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      })

      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsListening(false)
        setAudioStream(undefined)

        // Detener todos los tracks del stream
        stream.getTracks().forEach((track) => track.stop())

        // Crear blob del audio grabado
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })

        // Enviar a API de speech-to-text
        try {
          const formData = new FormData()
          formData.append("audio", audioBlob, "recording.webm")

          const response = await fetch("/api/speech-to-text", {
            method: "POST",
            body: formData,
          })

          const data = await response.json()

          if (data.text && data.text.trim()) {
            // Éxito - establecer el valor del input y enviar
            setInput(data.text)
            setTimeout(() => {
              const form = document.querySelector("[data-chat-form]") as HTMLFormElement
              if (form) {
                form.dispatchEvent(new Event("submit", { bubbles: true }))
              }
            }, 100)
            toast.success("Audio transcrito correctamente")
          } else if (response.status === 503 || response.status === 501) {
            // Servicio de STT no disponible
            toast.error(
              "Deepgram STT no configurado. Agrega DEEPGRAM_API_KEY a .env.local (obtén una en https://console.deepgram.com)",
              {
                duration: 5000,
              }
            )
          } else {
            // Sin transcripción pero sin error crítico
            if (data.message) {
              toast.error(data.message)
            } else {
              toast.error("No se pudo entender el audio. Intenta hablar más claramente.")
            }
          }
        } catch (error) {
          console.error("Error al procesar audio:", error)
          toast.error(
            "Error al procesar el audio. Verifica tu conexión. El servicio STT podría no estar disponible.",
            {
              duration: 4000,
            }
          )
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error("Error en MediaRecorder:", event)
        setIsListening(false)
        setAudioStream(undefined)
        stream.getTracks().forEach((track) => track.stop())
        toast.error("Error al grabar audio. Intenta de nuevo.")
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsListening(true)

      // Auto-detener después de 30 segundos
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop()
        }
      }, 30000)
    } catch (error) {
      console.error("Error al acceder al micrófono:", error)
      toast.error("No se pudo acceder al micrófono. Por favor, permite el acceso en tu navegador.")
      setIsListening(false)
      setAudioStream(undefined)
    }
  }

  return (
    <>
      {/* Sidebar Modal Grande con Blur */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-md transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-primary/14 bg-background/92 shadow-[0_32px_80px_rgba(2,6,23,0.28)] backdrop-blur-2xl transition-transform duration-300 ease-out sm:w-[620px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-primary/10 bg-linear-to-r from-primary/14 via-primary/6 to-transparent p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-primary/18 bg-linear-to-br from-primary/18 to-secondary/16 p-2.5 shadow-[0_14px_28px_rgba(59,130,246,0.18)]">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-xl">IA Assistant</h2>
              <p className="text-xs text-muted-foreground">Chatbot inteligente</p>
            </div>
          </div>
          <div className="flex gap-2">
            {messages.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setMessages([])
                        sessionStorage.removeItem(CHAT_SESSION_KEY)
                        toast.success("Chat limpiado")
                      }}
                      className="h-10 w-10 hover:bg-destructive/20 rounded-lg text-destructive transition-all duration-200 group relative"
                    >
                      <div className="relative">
                        <Trash2 className="h-5 w-5 transition-all duration-200 group-hover:scale-110" />
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-destructive text-destructive-foreground animate-in fade-in slide-in-from-top-2">
                    Eliminar chat
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-10 w-10 hover:bg-primary/20 rounded-lg"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages Content - Flex grow para que tome espacio disponible */}
        <ScrollArea className="flex-1 w-full p-6 overflow-y-auto" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                <div className="p-4 rounded-2xl bg-primary/10 backdrop-blur-sm">
                  <Sparkles className="h-12 w-12 text-primary mx-auto animate-pulse" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Hola! Soy tu Asistente IA</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Pregúntame sobre tu cartera, clientes o cualquier información de tu portafolio de préstamos.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full mt-6">
                  <button
                    onClick={() => {
                      setInput("¿Cuál es el estado de mi cartera?")
                      setTimeout(() => {
                        const form = document.querySelector("[data-chat-form]") as HTMLFormElement
                        if (form) form.dispatchEvent(new Event("submit", { bubbles: true }))
                      }, 100)
                    }}
                    className="rounded-2xl border border-border/80 bg-surface/70 p-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/55"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 mt-0.5" />
                      <span className="text-xs font-semibold">Estado Cartera</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Ver resumen general</p>
                  </button>
                  <button
                    onClick={() => {
                      setInput("¿Cuántos préstamos tengo vencidos?")
                      setTimeout(() => {
                        const form = document.querySelector("[data-chat-form]") as HTMLFormElement
                        if (form) form.dispatchEvent(new Event("submit", { bubbles: true }))
                      }, 100)
                    }}
                    className="rounded-2xl border border-border/80 bg-surface/70 p-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/55"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <AlertCircle className="h-4 w-4 mt-0.5" />
                      <span className="text-xs font-semibold">Préstamos Vencidos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Monitoreo de mora</p>
                  </button>
                  <button
                    onClick={() => {
                      setInput("¿Cuál es el valor total de mi portafolio?")
                      setTimeout(() => {
                        const form = document.querySelector("[data-chat-form]") as HTMLFormElement
                        if (form) form.dispatchEvent(new Event("submit", { bubbles: true }))
                      }, 100)
                    }}
                    className="rounded-2xl border border-border/80 bg-surface/70 p-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/55"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <DollarSign className="h-4 w-4 mt-0.5" />
                      <span className="text-xs font-semibold">Valor Total</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Portafolio total</p>
                  </button>
                  <button
                    onClick={() => {
                      setInput("¿Cuáles son mis clientes activos?")
                      setTimeout(() => {
                        const form = document.querySelector("[data-chat-form]") as HTMLFormElement
                        if (form) form.dispatchEvent(new Event("submit", { bubbles: true }))
                      }, 100)
                    }}
                    className="rounded-2xl border border-border/80 bg-surface/70 p-3 text-left shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-accent/55"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <Users className="h-4 w-4 mt-0.5" />
                      <span className="text-xs font-semibold">Clientes Activos</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Base de clientes</p>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 animate-in fade-in slide-in-from-bottom-2",
                    message.role === "user" && "flex-row-reverse"
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/20 text-primary"
                    )}
                  >
                    {message.role === "user" ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn("flex gap-2 max-w-md group")}>
                    <div
                      className={cn(
                        "px-4 py-3 rounded-2xl break-word backdrop-blur-sm transition-all max-w-none",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-none ml-auto"
                          : "bg-accent/60 text-foreground rounded-bl-none border border-border/60"
                      )}
                    >
                      {message.role === "user" ? (
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      ) : (
                        <div className="text-sm leading-relaxed [&>*]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-2 [&>ol]:my-2 [&>li]:my-0.5 [&>a]:underline [&>a]:text-primary">
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                      <p className="text-xs mt-2 opacity-60">
                        {message.createdAt
                          ? new Date(message.createdAt).toLocaleTimeString("es-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </p>
                    </div>

                    {/* TTS Button */}
                    {message.role === "assistant" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-primary/20"
                        onClick={() => handleSpeakMessage(message.id, message.content)}
                        title={playingMessageId === message.id ? "Detener" : "Escuchar"}
                      >
                        {playingMessageId === message.id ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="flex gap-1 rounded-2xl rounded-bl-none border border-border/60 bg-accent/60 px-4 py-3 backdrop-blur-sm">
                  <div
                    className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* Ref para auto-scroll */}
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Footer - Input Area (Static/Fixed) */}
        <div className="sticky bottom-0 space-y-3 border-t border-primary/10 bg-linear-to-r from-background via-background to-primary/5 p-6 shadow-xl shadow-background/50 backdrop-blur-xl">
          {/* Message Input */}
          <form onSubmit={handleSubmit} data-chat-form className="relative group">
            <div className="absolute inset-0 rounded-2xl bg-linear-to-r from-primary/18 via-primary/10 to-transparent blur opacity-0 transition duration-1000 group-focus-within:opacity-100" />
            <div className="relative flex gap-2">
              <TextareaAutosize
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tu pregunta..."
                minRows={1}
                maxRows={5}
                className="flex-1 resize-none rounded-2xl border border-primary/18 bg-surface/78 px-4 py-3 text-sm shadow-[0_12px_26px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-[border-color,box-shadow,background-color] focus:border-primary/45 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="lg"
                variant="default"
                disabled={isLoading || !input.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Voice Input Button */}
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "w-full gap-2 rounded-2xl border border-primary/18 bg-surface/76 font-semibold text-base shadow-[0_12px_26px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01]",
              isListening &&
                "scale-[1.01] animate-pulse border-primary/40 bg-primary/14 text-primary shadow-lg shadow-primary/25"
            )}
            onClick={handleVoiceInput}
          >
            {isListening ? (
              <>
                <MicOff className="h-5 w-5 animate-pulse" />
                <span>Detener grabación</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span>Habla con la IA</span>
              </>
            )}
          </Button>

          {/* Audio Visualizer */}
          {isListening && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <p className="text-xs text-muted-foreground">Analizando tu voz...</p>
              <BarVisualizer state="listening" barCount={12} mediaStream={audioStream} />
            </div>
          )}
        </div>
      </div>

      {/* Floating Button */}
      <FloatButton isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
    </>
  )
}

interface FloatButtonProps {
  isOpen: boolean
  onToggle: () => void
}

function FloatButton({ isOpen, onToggle }: FloatButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "fixed bottom-6 left-6 z-40 transition-all duration-300 ease-out",
              isOpen
                ? "opacity-0 scale-75 pointer-events-none -translate-x-10"
                : "opacity-100 scale-100 animate-in fade-in slide-in-from-bottom-8 duration-500"
            )}
          >
            <Button
              onClick={onToggle}
              className="group relative h-13 w-13 rounded-full border border-primary/20 bg-linear-to-br from-primary to-secondary p-0 shadow-[0_20px_40px_rgba(59,130,246,0.3)] transition-all duration-300 hover:-translate-y-2 hover:scale-110 hover:shadow-[0_28px_50px_rgba(59,130,246,0.36)]"
              variant="default"
            >
              <div className="relative flex items-center justify-center">
                <Sparkles className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180 group-hover:scale-110" />
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse group-hover:animate-ping" />
              </div>
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-sm font-medium">
          Preguntar a la IA
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
