// Función para transcribir audio usando Eleven Labs API
export async function transcribeAudio(audioFile: File): Promise<string> {
  try {
    const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY

    if (!ELEVEN_LABS_API_KEY) {
      console.error("Missing ELEVEN_LABS_API_KEY")
      throw new Error("API key not configured")
    }

    const formData = new FormData()
    formData.append("file", audioFile)
    formData.append("model_id", "eleven_multilingual_v2")

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_LABS_API_KEY,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Eleven Labs error: ${response.status}`)
    }

    const data = await response.json()
    return data.text || ""
  } catch (error) {
    console.error("Error transcribing audio:", error)
    throw error
  }
}
