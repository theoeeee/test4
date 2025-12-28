# 🧪 Tester votre connexion

## Test rapide depuis le terminal

### 1. Tester le backend
```bash



```
Résultat attendu : `{"status":"healthy"}`

### 2. Tester le login admin
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sitetrack.fr","password":"admin123"}'
```
Résultat attendu : Un JSON avec `"success":true` et les données de l'utilisateur

### 3. Tester avec vos propres identifiants
Si vous avez créé un utilisateur dans MongoDB, testez avec :
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"VOTRE_EMAIL","password":"VOTRE_MOT_DE_PASSE"}'
```

## Test depuis le navigateur

1. Ouvrez votre navigateur sur la page de login
2. Ouvrez les outils de développement (F12)
3. Allez dans l'onglet "Console"
4. Essayez de vous connecter
5. Regardez les erreurs dans la console

## Vérifier les logs du backend

Les logs du backend sont maintenant plus détaillés. Regardez le terminal où tourne uvicorn pour voir :
- Les tentatives de connexion
- Les erreurs éventuelles
- Les utilisateurs trouvés ou non

## Si vous avez créé des utilisateurs dans MongoDB Atlas

**Important** : Les utilisateurs doivent avoir le mot de passe en **clair** (pas hashé), car le backend compare directement les mots de passe.

Format attendu dans MongoDB :
```json
{
  "email": "votre@email.com",
  "password": "votremotdepasse",
  "name": "Votre Nom",
  "role": "admin" ou "driver",
  "id": "uuid-généré"
}
```

Pour créer un utilisateur correctement, utilisez l'API d'inscription :
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nouveau@email.com",
    "password": "motdepasse123",
    "name": "Nouvel Utilisateur",
    "role": "driver"
  }'
```





