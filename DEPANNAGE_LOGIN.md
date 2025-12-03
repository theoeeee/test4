# 🔧 Dépannage - Problème de connexion

## ✅ Vérifications effectuées

- ✅ MongoDB est connecté
- ✅ L'utilisateur admin existe dans la base de données
- ✅ Le backend répond correctement (testé avec curl)

## 🔍 Problèmes possibles et solutions

### 1. Le frontend ne peut pas accéder au backend

**Symptôme** : Erreur "Erreur de connexion" ou timeout dans le navigateur

**Solutions** :

#### A. Vérifier que le backend tourne
```bash
curl http://localhost:8000/api/health
```
Doit retourner : `{"status":"healthy"}`

#### B. Vérifier l'URL dans le frontend
Le frontend utilise par défaut `http://localhost:8000`. Si vous testez sur un appareil physique ou un autre ordinateur, vous devez utiliser l'IP de votre machine.

**Pour trouver votre IP locale** :
```bash
# Sur macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Sur Windows
ipconfig
```

**Configurer le frontend pour utiliser votre IP** :
Créez un fichier `frontend/.env` :
```env
EXPO_PUBLIC_BACKEND_URL=http://VOTRE_IP:8000
```
Remplacez `VOTRE_IP` par votre adresse IP locale (ex: `192.168.1.100`)

#### C. Vérifier les logs du navigateur
1. Ouvrez les outils de développement (F12)
2. Allez dans l'onglet "Console"
3. Essayez de vous connecter
4. Regardez les erreurs affichées

### 2. Les utilisateurs créés dans MongoDB n'ont pas le bon format

**Symptôme** : "Identifiants invalides" même avec le bon email/mot de passe

**Solution** : Vérifier le format des utilisateurs

Exécutez :
```bash
cd backend
source venv/bin/activate
python list_users.py
```

Les utilisateurs doivent avoir :
- `email` : string
- `password` : string (en clair, pas hashé)
- `name` : string
- `role` : string ("admin", "driver", etc.)
- `id` : string (UUID)

**Si vous avez créé des utilisateurs manuellement dans MongoDB Atlas** :
Ils doivent avoir exactement ce format. Le backend compare le mot de passe en clair.

### 3. Problème CORS

**Symptôme** : Erreur CORS dans la console du navigateur

**Solution** : Le backend est déjà configuré pour accepter toutes les origines. Si le problème persiste, vérifiez que le backend tourne bien.

### 4. Tester la connexion directement

**Test depuis le terminal** :
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sitetrack.fr","password":"admin123"}'
```

**Test depuis le navigateur** :
Ouvrez la console JavaScript (F12) et exécutez :
```javascript
fetch('http://localhost:8000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@sitetrack.fr',
    password: 'admin123'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### 5. Vérifier les utilisateurs dans MongoDB

**Lister tous les utilisateurs** :
```bash
cd backend
source venv/bin/activate
python list_users.py
```

**Créer un nouvel utilisateur via l'API** :
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "role": "driver"
  }'
```

## 📝 Checklist de dépannage

- [ ] Le backend tourne sur le port 8000
- [ ] MongoDB est connecté (test avec `python test_mongodb.py`)
- [ ] L'utilisateur existe dans MongoDB (test avec `python list_users.py`)
- [ ] Le login fonctionne via curl
- [ ] Le frontend peut accéder au backend (vérifier l'URL)
- [ ] Pas d'erreurs CORS dans la console
- [ ] Les logs du backend montrent les requêtes reçues

## 🆘 Si rien ne fonctionne

1. **Vérifiez les logs du backend** : Regardez le terminal où tourne uvicorn
2. **Vérifiez la console du navigateur** : F12 → Console
3. **Testez avec curl** pour isoler le problème frontend/backend
4. **Vérifiez votre fichier `.env`** dans `backend/` : La connexion MongoDB est-elle correcte ?

