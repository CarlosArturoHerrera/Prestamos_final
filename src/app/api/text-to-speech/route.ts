import { NextRequest, NextResponse } from 'next/server'

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || 'eastus'

const SPANISH_VOICES = {
  male: 'es-ES-AlvaroNeural',
  female: 'es-ES-ElviraNeural',
}

interface TTSRequest {
  text: string
  voiceGender?: 'male' | 'female'
}

function generateSSML(text: string, voiceName: string): string {
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!AZURE_SPEECH_KEY) {
      return NextResponse.json(
        {
          error: 'Azure Speech Service not configured',
          message: 'Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.local',
        },
        { status: 503 },
      )
    }

    const body: TTSRequest = await request.json()
    const { text, voiceGender = 'female' } = body

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 },
      )
    }

    if (text.length > 10000) {
      return NextResponse.json(
        { error: 'Text is too long (max 10000 characters)' },
        { status: 400 },
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
      console.error(`Azure TTS Error: ${response.status}`, error)
      return NextResponse.json(
        {
          error: 'Failed to generate speech',
          details: error,
        },
        { status: response.status },
      )
    }

    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('TTS API Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
