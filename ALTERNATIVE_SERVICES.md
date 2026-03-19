# Alternativas de TTS/STT Económicas

## Comparativa de Servicios

### Para Text-to-Speech (TTS)

| Servicio | Costo | Free Tier | Latencia | Calidad | Idiomas |
|----------|-------|-----------|----------|---------|---------|
| **Web Speech API** | Gratis | Ilimitado | Muy baja | Buena | Múltiples |
| Google Cloud TTS | $16/1M chars | 1M chars/mes | Media | Excelente | 220+ voces |
| Azure Speech | $4/1K requests | 5K requests/mes | Baja | Excelente | 215+ voces |
| ElevenLabs | $5/10K chars | No | Muy baja | Premium | 32 idiomas |
| Synthesys | $3-5/1M chars | No | Media | Buena | 264 voces |

**Recomendación: Web Speech API Nativa** (Ya implementada, sin costo)

---

### Para Speech-to-Text (STT)

| Servicio | Costo | Free Tier | Exactitud | Idiomas | API |
|----------|-------|-----------|-----------|---------|-----|
| Google Cloud STT | $0.024/15min | 60min/mes | 99%+ | 125+ | REST/gRPC |
| Azure Speech | $1/audio hour | 5K registros/mes | 99%+ | 110+ | REST |
| Deepgram | $0.0043/min | 200K tokens/mes | 95%+ | 40+ | REST/WebSocket |
| AssemblyAI | $0.0000085/sec | No | 95%+ | 99 | REST |
| OpenAI Whisper API | $0.02/min | No | 98%+ | 99 | REST |

**Recomendación: Google Cloud STT** (60 min gratis/mes = suficiente para mayoría de casos)
**Alternativa: Deepgram** (200K tokens/mes gratis, API más simple)

---

## Implementación Recomendada

### Opción 1: Mejor Relación Costo-Beneficio (Recomendada)
- **TTS**: Web Speech API Nativa (✅ Ya implementada) - **$0/mes**
- **STT**: Google Cloud Speech-to-Text - **$0-24/mes** (60 min gratis)
- **Total**: $0-24/mes

### Opción 2: Máxima Economía
- **TTS**: Web Speech API Nativa - **$0/mes**
- **STT**: Deepgram - **$0-5/mes** (200K tokens gratis)
- **Total**: $0-5/mes

### Opción 3: Máxima Calidad
- **TTS**: Google Cloud - **$0-16/mes**
- **STT**: Google Cloud - **$0-24/mes**
- **Total**: $0-40/mes

---

## Configuración

### Google Cloud STT (Recomendado)

1. **Crear proyecto en Google Cloud Console**
2. **Activar Speech-to-Text API**
3. **Crear credenciales (Service Account)**
4. **Descargar JSON y configurar en `.env.local`**:
   ```
   GOOGLE_CLOUD_STT_KEY_FILE=/path/to/credentials.json
   ```

### Deepgram STT (Alternativa)

1. **Registrarse en Deepgram**
2. **Crear API Key en dashboard**
3. **Configurar en `.env.local`**:
   ```
   DEEPGRAM_API_KEY=your_api_key_here
   ```

---

## Conclusión

Para este proyecto ERP-Préstamos:
- **TTS**: Mantener Web Speech API (gratis, incorporada)
- **STT**: Usar Google Cloud (60 min gratis/mes es suficiente para un chatbot)
- **Costo total**: $0-5/mes (dentro del free tier)

Esto elimina completamente la dependencia de Eleven Labs y reduce costos drásticamente.
