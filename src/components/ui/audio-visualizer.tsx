import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface AudioVisualizerProps {
  isActive: boolean
  audioStream?: MediaStream
  className?: string
}

export function AudioVisualizer({
  isActive,
  audioStream,
  className,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!isActive || !audioStream || !canvasRef.current) {
      return
    }

    // Inicializar contexto de audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContextRef.current = audioContext

    // Crear nodo analyser
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    analyserRef.current = analyser

    // Crear array para datos
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    dataArrayRef.current = dataArray

    // Conectar stream al analyser
    const source = audioContext.createMediaStreamSource(audioStream)
    source.connect(analyser)

    // Dibujar visualización
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Ajustar canvas size
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resizeCanvas()

    // Función de animación
    const draw = () => {
      animationIdRef.current = requestAnimationFrame(draw)

      if (!analyser || !dataArray || !ctx) return

      analyser.getByteFrequencyData(dataArray)

      // Limpiar canvas
      ctx.fillStyle = "rgb(20, 20, 20)"
      ctx.fillRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1))

      // Dibujar barras
      const barWidth = (canvas.width / (window.devicePixelRatio || 1)) / dataArray.length
      let barHeight
      let x = 0

      for (let i = 0; i < dataArray.length; i++) {
        barHeight = (dataArray[i] / 255) * (canvas.height / (window.devicePixelRatio || 1))

        // Gradiente de color
        const hue = (i / dataArray.length) * 360
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`
        ctx.fillRect(x, (canvas.height / (window.devicePixelRatio || 1)) - barHeight, barWidth - 1, barHeight)

        x += barWidth
      }
    }

    draw()

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      source.disconnect()
    }
  }, [isActive, audioStream])

  return (
    <div
      className={cn(
        "w-full h-20 rounded-xl bg-gradient-to-b from-black/40 to-black/20 backdrop-blur-sm border border-primary/20 overflow-hidden",
        !isActive && "opacity-50",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: isActive ? "block" : "none" }}
      />
      {!isActive && (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
          Inicia la grabación para ver el visualizador
        </div>
      )}
    </div>
  )
}
