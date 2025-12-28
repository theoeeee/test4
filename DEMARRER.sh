#!/bin/bash

# Script de démarrage rapide pour SiteTrack

echo "🚀 Démarrage de SiteTrack..."
echo ""

# Vérifier si Python est installé
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

echo "📦 Vérification des dépendances..."

# Backend
if [ ! -d "backend/venv" ]; then
    echo "📥 Installation des dépendances Python..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    cd ..
    echo "✅ Dépendances Python installées"
else
    echo "✅ Environnement virtuel Python trouvé"
fi

# Frontend
if [ ! -d "frontend/node_modules" ]; then
    echo "📥 Installation des dépendances Node.js..."
    cd frontend
    npm install
    cd ..
    echo "✅ Dépendances Node.js installées"
else
    echo "✅ Dépendances Node.js trouvées"
fi

echo ""
echo "⚠️  IMPORTANT :"
echo "1. Assurez-vous d'avoir configuré MongoDB dans backend/.env"
echo "2. Le backend démarrera sur http://localhost:8000"
echo "3. Le frontend démarrera avec Expo"
echo ""
echo "📝 Pour démarrer manuellement :"
echo ""
echo "Terminal 1 - Backend :"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  uvicorn server:app --reload --port 8000"
echo ""
echo "Terminal 2 - Frontend :"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "Ou consultez GUIDE_DEMARRAGE.md pour plus de détails"
echo ""





