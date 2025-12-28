# 🔧 Configuration MongoDB pour SiteTrack

## Problème actuel
Le backend ne peut pas se connecter à MongoDB, ce qui empêche le login admin de fonctionner.

## Solution 1 : MongoDB Atlas (Recommandé - Gratuit et Simple)

### Étapes :

1. **Créer un compte gratuit** sur https://www.mongodb.com/cloud/atlas
   - Cliquez sur "Try Free"
   - Créez un compte (gratuit)

2. **Créer un cluster gratuit**
   - Choisissez "M0 Free" (gratuit pour toujours)
   - Sélectionnez une région proche (ex: Europe - Paris)
   - Cliquez sur "Create"

3. **Configurer l'accès réseau**
   - Allez dans "Network Access"
   - Cliquez sur "Add IP Address"
   - Cliquez sur "Allow Access from Anywhere" (pour développement)
   - Ou ajoutez votre IP actuelle

4. **Créer un utilisateur de base de données**
   - Allez dans "Database Access"
   - Cliquez sur "Add New Database User"
   - Choisissez "Password" comme méthode d'authentification
   - Créez un nom d'utilisateur (ex: `sitetrack`) et un mot de passe
   - Rôle : "Atlas admin" ou "Read and write to any database"
   - Cliquez sur "Add User"

5. **Obtenir la chaîne de connexion**
   - Allez dans "Database" → Cliquez sur "Connect"
   - Choisissez "Connect your application"
   - Copiez la chaîne de connexion (Connection String)
   - Elle ressemble à : `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`

6. **Configurer dans votre projet**
   - Modifiez `backend/.env` :
   ```env
   MONGO_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
   DB_NAME=delivery_tracker
   ```
   - Remplacez `username` et `password` par vos identifiants
   - Remplacez `cluster0.xxxxx.mongodb.net` par votre cluster

7. **Redémarrer le backend**
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn server:app --reload --port 8000
   ```

## Solution 2 : MongoDB Local

### Sur macOS avec Homebrew :

```bash
# Installer MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Démarrer MongoDB
brew services start mongodb-community

# Vérifier que MongoDB tourne
mongosh
```

Puis dans `backend/.env` :
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=delivery_tracker
```

## Vérification

Une fois MongoDB configuré, le backend créera automatiquement :
- ✅ L'utilisateur admin : `admin@sitetrack.fr` / `admin123`
- ✅ Les routes de démo
- ✅ Les caméras de démo

Vous pourrez alors vous connecter avec ces identifiants dans l'application !

## Dépannage

Si vous voyez des erreurs de connexion :
1. Vérifiez que MongoDB est démarré (local) ou que votre cluster Atlas est actif
2. Vérifiez votre `.env` dans `backend/`
3. Vérifiez les logs du backend pour voir les erreurs exactes
4. Pour MongoDB Atlas, assurez-vous que votre IP est autorisée dans "Network Access"





