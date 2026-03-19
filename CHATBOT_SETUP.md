# 🤖 Chatbot IA Completo - Documentación

Tu chatbot IA está ahora completamente funcional y conectado a tu base de datos. Aquí te explico cómo funciona:

## 🎯 Características Implementadas

### 1. **Chat Inteligente con GROQ + Vercel AI SDK**
- El chatbot usa GROQ (modelo mixtral-8x7b) para generar respuestas inteligentes
- Vercel AI SDK maneja el streaming de respuestas en tiempo real
- Las respuestas se actualizan en tiempo real mientras se generan

### 2. **Acceso a Base de Datos en Vivo**
El chatbot puede hacer consultas sobre:
- **Portafolio**: Valor total, cantidad de préstamos, tasa promedio de interés
- **Clientes**: Información activa, búsqueda por nombre
- **Préstamos**: Estado, monto, saldo, fechas de vencimiento
- **Métricas**: Préstamos en mora, en riesgo, por vencer

### 3. **Modo Voz (Speech-to-Text)**
- Presiona el botón de micrófono para grabar tu voz
- El audio se envía a Eleven Labs para transcribirse
- La transcripción se convierte automáticamente en un mensaje

### 4. **Text-to-Speech (TTS)**
- Haz clic en el botón 🔊 para escuchar las respuestas del IA
- Usa la voz de Eleven Labs para una experiencia natural
- El audio se reproduce directamente en el navegador

## 📁 Estructura de Archivos Creados

```
src/
├── app/api/chat/route.ts              # Endpoint principal del chat
├── app/api/speech-to-text/route.ts    # API para transcribir audio
├── lib/
│   ├── ai-helpers.ts                  # Funciones para consultar Supabase
│   ├── text-to-speech.ts              # Funciones de síntesis de voz
│   └── speech-to-text.ts              # Funciones de reconocimiento de voz
└── components/dashboard/
    └── chat-sidebar.tsx               # Componente mejorado del chat
```

## 🔧 Variables de Entorno (Ya Configuradas)

```env
# AI Models
ELEVEN_LABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 💬 Ejemplos de Preguntas que Puedes Hacer

### Consultas de Portafolio
- "¿Cuál es el estado actual de mi cartera?"
- "¿Cuántos préstamos tengo activos?"
- "¿Cuál es la tasa de interés promedio?"
- "¿Cuántos préstamos están en mora?"

### Consultas de Clientes
- "Busca información del cliente Juan García"
- "¿Cuántos clientes activos tengo?"
- "Muéstrame los préstamos de un cliente específico"

### Análisis
- "¿Cuál es el valor total de mi portafolio?"
- "¿Cuál es el porcentaje de mora?"
- "¿Qué préstamos están próximos a vencer?"

## 🎤 Cómo Usar la Voz

### Speech-to-Text (Hablar para escribir)
1. Haz clic en el botón de micrófono 🎤
2. Habla tu pregunta en español
3. El botón mostrará "Escuchando..."
4. Haz clic nuevamente para detener o espera 30 segundos
5. Tu audio será transcrito automáticamente

### Text-to-Speech (Escuchar respuestas)
1. El chatbot responde a tu pregunta
2. Haz clic en el ícono 🔊 en la respuesta del IA
3. La respuesta se reproducirá en voz natural
4. Haz clic nuevamente para detener

## 🔌 Cómo Funciona la Integración

### 1. Usuario Envía Mensaje
```
Usuario: "¿Cuál es el estado de mi cartera?"
        ↓
        POST /api/chat
```

### 2. Sistema Construye Contexto
```
- Consulta Supabase por datos en vivo
- Obtiene: clientes, préstamos, métricas
- Crea un "contexto" con esta información
```

### 3. GROQ Genera Respuesta
```
- Vercel AI SDK envía mensajes + contexto a GROQ
- GROQ analiza la información y genera respuesta
- Usa streaming para respuestas en tiempo real
```

### 4. IA Responde
```
"Tu cartera tiene 12 préstamos activos con un valor total de $45,230.50..."
        ↓
Usuario ve respuesta en tiempo real
```

### 5. (Opcional) Reproducir con Voz
```
Usuario hace clic en 🔊
        ↓
Eleven Labs convierte texto a audio
        ↓
Audio se reproduce en navegador
```

## 🚀 Próximas Mejoras Sugeridas

Si quieres mejorar aún más tu chatbot:

1. **Agregar historial persistente**
   - Guardar conversaciones en Supabase
   - Recuperar histórico de chats anteriores

2. **Mejorar el system prompt**
   - Agregar reglas específicas de tu negocio
   - Añadir formatos de respuesta específicos

3. **Análisis predictivo**
   - Usar IA para predecir clientes con riesgo de mora
   - Recomendaciones de cobranza

4. **Integración con más datos**
   - Segmentación de clientes
   - Reportes automáticos
   - Alertas en tiempo real

5. **Personalización de voz**
   - Cambiar el ID de voz (actualmente usa voz female estándar)
   - Ajustar velocidad y entonación

## 🐛 Solución de Problemas

### "Error al procesar audio"
- Verifica que el API key de Eleven Labs esté correcto
- Asegúrate de tener permisos de micrófono en tu navegador

### "El chatbot no responde"
- Verifica que GROQ_API_KEY esté configurado
- Comprueba la conexión a internet
- Revisa la consola del navegador para errores

### "No puedo escuchar la respuesta"
- Verifica que el volumen del navegador esté activado
- Comprueba que tienes un API key válido de Eleven Labs
- Intenta con una respuesta más corta

### "La transcripción no funciona"
- Asegúrate de permitir acceso al micrófono
- Usa un navegador moderno (Chrome, Firefox, Edge, Safari)
- Prueba con una frase más larga y clara

## 📚 Recursos Útiles

- [Vercel AI SDK Docs](https://sdk.vercel.ai)
- [GROQ Console](https://console.groq.com)
- [Eleven Labs Documentation](https://elevenlabs.io/docs)
- [Supabase Documentation](https://supabase.com/docs)

## ✅ Checklist de Verificación

- [x] Chatbot conectado a Supabase
- [x] GROQ generando respuestas con contexto
- [x] Speech-to-Text funcionando
- [x] Text-to-Speech implementado
- [x] UI mejorada con Vercel AI SDK
- [x] Streaming de respuestas en tiempo real
- [x] Variables de entorno configuradas

¡Tu chatbot IA está listo para usar! 🎉
