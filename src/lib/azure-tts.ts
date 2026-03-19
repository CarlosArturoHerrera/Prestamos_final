/**
 * Azure Text-to-Speech Service
 * Uses Azure Speech Services for high-quality TTS
 * Free tier: 5 million characters per month
 */

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus'

// Voice options in Spanish (es-ES)
const SPANISH_VOICES = {
  male: 'es-ES-AlvaroNeural', // Male voice
  female: 'es-ES-ElviraNeural', // Female voice (default)
}

/**
 * Generate speech from text using Azure Speech Service
 * @param text - The text to convert to speech
 * @param voiceGender - 'male' or 'female' (default: 'female')
 * @returns Promise<ArrayBuffer> - Audio data in WAV format
 */
export async function generateAzureSpeech(
  text: string,
  voiceGender: 'male' | 'female' = 'female',
): Promise<ArrayBuffer> {
  if (typeof window !== 'undefined') {
    // Server-side only
    throw new Error('Azure TTS must be called from server-side API')
  }

  if (!AZURE_SPEECH_KEY) {
    throw new Error(
      'Azure Speech Key not configured. Set AZURE_SPEECH_KEY in .env.local',
    )
  }

  const voiceName = SPANISH_VOICES[voiceGender]
  const ssmlText = generateSSML(text, voiceName)

  const response = await fetch(
    `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
      },
      body: ssmlText,
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Azure TTS Error: ${response.status} - ${error}`)
  }

  return response.arrayBuffer()
}

/**
 * Generate SSML (Speech Synthesis Markup Language) for Azure TTS
 * @param text - The text to convert
 * @param voiceName - The voice name to use
 * @returns SSML formatted string
 */
function generateSSML(text: string, voiceName: string): string {
  // Escape XML special characters
  const escapeXML = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const safeText = escapeXML(text)

  return `<speak version='1.0' xml:lang='es-ES'>
    <voice name='${voiceName}'>
      <prosody rate='0.95' pitch='1.0'>
        ${safeText}
      </prosody>
    </voice>
  </speak>`
}

/**
 * Play audio data directly in browser
 * @param audioBuffer - ArrayBuffer with audio data
 */
export function playAudioBuffer(audioBuffer: ArrayBuffer): void {
  if (typeof window === 'undefined') {
    throw new Error('playAudioBuffer must be called from client-side')
  }

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const blob = new Blob([audioBuffer], { type: 'audio/mp3' })
  const url = URL.createObjectURL(blob)

  const audio = new Audio(url)
  audio.onended = () => URL.revokeObjectURL(url)
  audio.play().catch((err) => console.error('Error playing audio:', err))
}

/**
 * Synthesize and play text using Azure TTS
 * @param text - The text to speak
 * @param voiceGender - 'male' or 'female'
 */
export async function speakWithAzure(
  text: string,
  voiceGender: 'male' | 'female' = 'female',
): Promise<void> {
  try {
    // Call the API endpoint instead of Azure directly from client
    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceGender,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to generate speech')
    }

    const audioBuffer = await response.arrayBuffer()
    playAudioBuffer(audioBuffer)
  } catch (error) {
    console.error('Error in speakWithAzure:', error)
    throw error
  }
}

/**
 * Stop all audio playback
 */
export function stopAudio(): void {
  if (typeof window === 'undefined') return

  // Stop all audio elements
  const audioElements = document.querySelectorAll('audio')
  audioElements.forEach((audio) => {
    audio.pause()
    audio.currentTime = 0
  })
}
