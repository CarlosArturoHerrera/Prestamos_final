import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json(
        { error: "No se proporcionó archivo de audio", text: "" },
        { status: 400 }
      )
    }

    // Opción 1: Google Cloud Speech-to-Text
    const GOOGLE_CLOUD_STT_KEY = process.env.GOOGLE_CLOUD_STT_API_KEY
    if (GOOGLE_CLOUD_STT_KEY) {
      return await transcribeWithGoogleCloud(audioFile, GOOGLE_CLOUD_STT_KEY)
    }

    // Opción 2: Deepgram
    const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY
    if (DEEPGRAM_API_KEY) {
      return await transcribeWithDeepgram(audioFile, DEEPGRAM_API_KEY)
    }

    // Opción 3: Sin servicio configurado
    console.warn("No hay servicio STT configurado. Configure GOOGLE_CLOUD_STT_API_KEY o DEEPGRAM_API_KEY")
    return NextResponse.json(
      {
        error: "Servicio de STT no disponible",
        text: "",
        message: "No hay servicio de reconocimiento de voz configurado. Configura Google Cloud o Deepgram. Ver ALTERNATIVE_SERVICES.md",
      },
      { status: 503 }
    )
  } catch (error) {
    console.error("Error en speech-to-text:", error)
    return NextResponse.json(
      {
        error: "Error al procesar el audio",
        text: "",
        message: "Hubo un error al transcribir. Intenta de nuevo.",
      },
      { status: 500 }
    )
  }
}

// Transcribir con Google Cloud Speech-to-Text
async function transcribeWithGoogleCloud(
  audioFile: File,
  apiKey: string
): Promise<NextResponse> {
  try {
    const buffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(buffer).toString("base64")

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config: {
            encoding: "WEBM_OPUS",
            languageCode: "es-ES",
            audioChannelCount: 1,
          },
          audio: {
            content: base64Audio,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Error de Google Cloud:", errorData)

      return NextResponse.json(
        {
          error: "Error al transcribir con Google Cloud",
          text: "",
          message: "No se pudo procesar el audio. Intenta de nuevo.",
        },
        { status: 500 }
      )
    }

    const data = await response.json()
    const transcript = data.results
      ?.map((result: any) =>
        result.alternatives?.[0]?.transcript || ""
      )
      .join(" ") || ""

    return NextResponse.json({
      text: transcript,
      success: true,
    })
  } catch (error) {
    console.error("Error en Google Cloud STT:", error)
    return NextResponse.json(
      {
        error: "Error al procesar con Google Cloud",
        text: "",
        message: "Hubo un error. Intenta de nuevo.",
      },
      { status: 500 }
    )
  }
}

// Transcribir con Deepgram
async function transcribeWithDeepgram(
  audioFile: File,
  apiKey: string
): Promise<NextResponse> {
  try {
    const buffer = await audioFile.arrayBuffer()

    const response = await fetch("https://api.deepgram.com/v1/listen?language=es&model=nova-2", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audioFile.type || "audio/webm",
      },
      body: buffer,
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Error de Deepgram:", errorData)

      return NextResponse.json(
        {
          error: "Error al transcribir con Deepgram",
          text: "",
          message: "No se pudo procesar el audio. Intenta de nuevo.",
        },
        { status: 500 }
      )
    }

    const data = await response.json()
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""

    return NextResponse.json({
      text: transcript,
      success: true,
    })
  } catch (error) {
    console.error("Error en Deepgram STT:", error)
    return NextResponse.json(
      {
        error: "Error al procesar con Deepgram",
        text: "",
        message: "Hubo un error. Intenta de nuevo.",
      },
      { status: 500 }
    )
  }
}
