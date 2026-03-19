#!/bin/bash
# Script para configurar Azure Speech Services

echo "🔧 Configurador de Azure Speech Services"
echo "========================================"
echo ""

# Verificar si .env.local existe
if [ ! -f ".env.local" ]; then
    echo "❌ No se encontró .env.local"
    echo "Por favor, crea el archivo .env.local en la raíz del proyecto"
    exit 1
fi

# Pedir credenciales de Azure
read -p "📝 Ingresa tu AZURE_SPEECH_KEY (API Key): " api_key
read -p "📝 Ingresa tu AZURE_SPEECH_REGION (ej: eastus): " region

# Validar que no estén vacíos
if [ -z "$api_key" ] || [ -z "$region" ]; then
    echo "❌ Las credenciales no pueden estar vacías"
    exit 1
fi

# Actualizar .env.local
# Remover líneas anteriores si existen
sed -i '/AZURE_SPEECH_KEY=/d' .env.local
sed -i '/AZURE_SPEECH_REGION=/d' .env.local

# Agregar nuevas líneas
echo "" >> .env.local
echo "# Azure Speech Service" >> .env.local
echo "AZURE_SPEECH_KEY=$api_key" >> .env.local
echo "AZURE_SPEECH_REGION=$region" >> .env.local

echo ""
echo "✅ Configuración completada!"
echo ""
echo "📋 Archivo actualizado:"
grep -E "AZURE_SPEECH" .env.local
echo ""
echo "🚀 Próximo paso: bun run dev"
