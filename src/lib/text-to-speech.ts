// Usar Web Speech API nativa (disponible en navegadores modernos)
// Servicio GRATIS, sin limitaciones de quota
export async function generateSpeech(text: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        console.error("Web Speech API no disponible en este navegador")
        resolve(null)
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      
      // Configurar para español
      utterance.lang = "es-ES"
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      
      // Cuando termine, resolver la promesa
      utterance.onend = () => {
        resolve(null) // Web Speech API no retorna blob, pero cumplimos la interfaz
      }
      
      utterance.onerror = (event) => {
        console.error("Error en síntesis de voz:", event.error)
        resolve(null)
      }
      
      // Reproducir inmediatamente
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("Error in generateSpeech:", error)
      resolve(null)
    }
  })
}

// Función para reproducir usando Web Speech API
export async function playAudio(audioBlob: Blob) {
  // No se usa blob, pero mantenemos compatibilidad
  try {
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    audio.play()

    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(audioUrl)
    })
  } catch (error) {
    console.error("Error playing audio:", error)
  }
}

// Función para reproducir texto directamente con Web Speech API
export function playTextWithNativeVoice(text: string): void {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return
    }

    // Cancelar cualquier voz en reproducción
    window.speechSynthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "es-ES"
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    
    window.speechSynthesis.speak(utterance)
  } catch (error) {
    console.error("Error playing text with native voice:", error)
  }
}

// Función para detener reproducción
export function stopSpeech(): void {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return
    }

    window.speechSynthesis.cancel()
  } catch (error) {
    console.error("Error stopping speech:", error)
  }
}

// Obtener voz de como Stream (para respuestas largas)
export async function getSpeechStream(text: string): Promise<ReadableStream<Uint8Array> | null> {
  // Con Web Speech API nativa, no hay stream, pero iniciamos reproducción
  playTextWithNativeVoice(text)
  return null
}
