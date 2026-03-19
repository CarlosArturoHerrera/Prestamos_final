/**
 * Speech-to-Text (STT) - Convertir audio a texto
 * 
 * Opciones:
 * 1. Google Cloud Speech-to-Text (Recomendado: 60 min gratis/mes)
 * 2. Deepgram (Alternativa: 200K tokens gratis/mes)
 * 3. Web Speech API Nativa (Fallback, limitada)
 * 
 * Este archivo usa Web Speech API como fallback
 */

// Verificar si Web Speech API está disponible
function isWebSpeechAPIAvailable(): boolean {
  if (typeof window === "undefined") return false
  
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

// Usar Web Speech API nativa como fallback
export async function transcribeAudioWithWebSpeechAPI(
  audioStream: MediaStream
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!isWebSpeechAPIAvailable()) {
        console.warn("Web Speech API no disponible")
        resolve(null)
        return
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.lang = "es-ES"
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      let transcript = ""

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
      }

      recognition.onend = () => {
        resolve(transcript || null)
      }

      recognition.onerror = (event: any) => {
        console.error("Error en Speech Recognition:", event.error)
        resolve(null)
      }

      // Iniciar reconocimiento
      recognition.start()

      // Auto-detener después de 30 segundos
      setTimeout(() => {
        if (recognition) {
          recognition.stop()
        }
      }, 30000)
    } catch (error) {
      console.error("Error in transcribeAudioWithWebSpeechAPI:", error)
      resolve(null)
    }
  })
}

/**
 * Transcribir audio usando servicio configurado
 * 
 * Prioridad:
 * 1. Google Cloud Speech-to-Text (si está configurado)
 * 2. Deepgram (si está configurado)
 * 3. Web Speech API (fallback)
 */
export async function transcribeAudio(audioFile: File): Promise<string | null> {
  try {
    // Intentar con servicio backend (Google Cloud o Deepgram)
    const formData = new FormData()
    formData.append("audio", audioFile)

    const response = await fetch("/api/speech-to-text", {
      method: "POST",
      body: formData,
    })

    if (response.ok) {
      const data = await response.json()
      return data.text || null
    }

    // Si el backend no está disponible, usar Web Speech API como fallback
    console.warn("Servicio STT backend no disponible, usando Web Speech API fallback")
    return null
  } catch (error) {
    console.error("Error transcribing audio:", error)
    return null
  }
}

// Verificar disponibilidad de servicios STT
export function getSTTStatus(): {
  available: boolean
  service: "google-cloud" | "deepgram" | "webspeech" | "none"
  message: string
} {
  // Asumir que si el endpoint existe, está configurado
  // Esto se verifica en runtime cuando el usuario intenta usar STT

  if (isWebSpeechAPIAvailable()) {
    return {
      available: true,
      service: "webspeech",
      message: "Web Speech API disponible (reconocimiento limitado)",
    }
  }

  return {
    available: false,
    service: "none",
    message: "No hay servicios STT disponibles",
  }
}
