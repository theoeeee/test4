# 🚀 Guide de Démarrage - SiteTrack

Ce guide vous explique comment lancer votre application SiteTrack (backend + frontend).

## 📋 Prérequis

1. **Python 3.8+** installé
2. **Node.js** et **npm** (ou **yarn**) installés
3. **MongoDB** - Vous pouvez utiliser :
   - MongoDB Atlas (cloud, gratuit) : https://www.mongodb.com/cloud/atlas
   - MongoDB local installé sur votre machine

## 🔧 Configuration du Backend

### 1. Installer les dépendances Python

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Sur macOS/Linux
# ou: venv\Scripts\activate  # Sur Windows
pip install -r requirements.txt
```

### 2. Configurer les variables d'environnement

Créez un fichier `.env` dans le dossier `backend/` :

```bash
cd backend
touch .env
```

Ajoutez ces lignes dans le fichier `.env` :

```env
MONGO_URL=mongodb://localhost:27017
# OU pour MongoDB Atlas :
# MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/

DB_NAME=delivery_tracker
```

**Pour MongoDB Atlas (recommandé pour débuter) :**
1. Créez un compte gratuit sur https://www.mongodb.com/cloud/atlas
2. Créez un cluster gratuit
3. Créez un utilisateur de base de données
4. Obtenez votre chaîne de connexion (Connection String)
5. Remplacez `<password>` et `<username>` dans l'URL

### 3. Démarrer le serveur backend

```bash
cd backend
source venv/bin/activate  # Si pas déjà activé
uvicorn server:app --reload --port 8000
```

Le backend sera accessible sur : **http://localhost:8000**

Vous pouvez tester l'API sur : **http://localhost:8000/docs** (documentation Swagger)

## 🎨 Configuration du Frontend

### 1. Installer les dépendances

```bash
cd frontend
npm install
# OU si vous utilisez yarn :
yarn install
```

### 2. Configurer l'URL de l'API (si nécessaire)

L'URL de l'API est configurée dans `frontend/src/services/api.ts` et pointe par défaut vers `http://localhost:8000`.

**Pour tester sur un appareil physique**, créez un fichier `.env` dans `frontend/` avec :
```env
EXPO_PUBLIC_BACKEND_URL=http://VOTRE_IP_LOCALE:8000
```
Remplacez `VOTRE_IP_LOCALE` par l'adresse IP de votre machine (trouvez-la avec `ifconfig` sur macOS/Linux ou `ipconfig` sur Windows).

### 3. Démarrer le frontend

**Option A : Pour le Web (navigateur)**
```bash
cd frontend
npm run web
# OU
yarn web
```

**Option B : Pour iOS (simulateur)**
```bash
cd frontend
npm run ios
# OU
yarn ios
```

**Option C : Pour Android (émulateur)**
```bash
cd frontend
npm run android
# OU
yarn android
```

**Option D : Mode développement (choix interactif)**
```bash
cd frontend
npm start
# OU
yarn start
```

Cette commande ouvrira Expo DevTools où vous pourrez choisir :
- Appuyer sur `w` pour ouvrir dans le navigateur web
- Appuyer sur `i` pour iOS simulator
- Appuyer sur `a` pour Android emulator
- Scanner le QR code avec l'app Expo Go sur votre téléphone

## 🌐 Accéder à votre application

### Frontend Web
Une fois `npm run web` lancé, l'application s'ouvrira automatiquement dans votre navigateur, généralement sur :
- **http://localhost:8081** (ou un autre port affiché dans le terminal)

### Backend API
- **API principale** : http://localhost:8000
- **Documentation API** : http://localhost:8000/docs
- **Interface alternative** : http://localhost:8000/redoc

## 📱 Application Mobile

Si vous voulez tester sur votre téléphone :

1. Installez l'application **Expo Go** depuis l'App Store (iOS) ou Google Play (Android)
2. Lancez `npm start` dans le dossier `frontend`
3. Scannez le QR code affiché dans le terminal avec :
   - **iOS** : L'appareil photo natif
   - **Android** : L'app Expo Go

## ⚠️ Dépannage

### Erreur de connexion MongoDB
- Vérifiez que MongoDB est démarré (si local)
- Vérifiez votre chaîne de connexion dans `.env`
- Pour MongoDB Atlas, assurez-vous que votre IP est autorisée dans les Network Access

### Erreur CORS
Le backend est déjà configuré pour accepter les requêtes depuis le frontend. Si vous avez des problèmes, vérifiez la configuration CORS dans `backend/server.py`.

### Port déjà utilisé
Si le port 8000 est occupé, changez-le :
```bash
uvicorn server:app --reload --port 8001
```
Et mettez à jour l'URL dans le frontend.

## 🎯 Commandes Rapides

**Terminal 1 - Backend :**
```bash
cd backend
source venv/bin/activate
uvicorn server:app --reload --port 8000
```

**Terminal 2 - Frontend :**
```bash
cd frontend
npm start
# Puis appuyez sur 'w' pour web, 'i' pour iOS, 'a' pour Android
```

Bon développement ! 🚀

