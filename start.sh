#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "✨ Iniciando DecorWall AI - Visualizador de Paneles Decorativos"
echo "=========================================================="

# Activar venv
source "$DIR/backend/venv/bin/activate"

# Iniciar servidor Uvicorn en segundo plano o interactivo
echo "🚀 Servidor web listo en: http://localhost:8000"
echo "Presiona Ctrl+C para detener."
exec uvicorn main:app --app-dir "$DIR/backend" --host 0.0.0.0 --port 8000 --reload
