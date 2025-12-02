# 🔐 Résoudre le problème d'authentification MongoDB

L'erreur "bad auth : authentication failed" signifie que le mot de passe dans votre `.env` ne correspond pas à celui configuré dans MongoDB Atlas.

## Solution : Réinitialiser le mot de passe dans MongoDB Atlas

### Étapes :

1. **Allez sur MongoDB Atlas** : https://cloud.mongodb.com/
   - Connectez-vous à votre compte

2. **Allez dans "Database Access"** (menu de gauche)

3. **Trouvez l'utilisateur `theolacome_db_user`**
   - Si vous ne le voyez pas, créez-en un nouveau (voir ci-dessous)

4. **Cliquez sur "Edit"** puis **"Edit Password"**

5. **Créez un nouveau mot de passe SIMPLE** (sans caractères spéciaux pour éviter l'encodage) :
   - Exemple : `SiteTrack2024` ou `Admin123456`
   - ⚠️ **Notez-le bien !**

6. **Cliquez sur "Update User"**

7. **Mettez à jour votre fichier `.env`** :
   ```env
   MONGO_URL=mongodb+srv://theolacome_db_user:VOTRE_NOUVEAU_MOT_DE_PASSE@cluster00.w3eft3p.mongodb.net/
   DB_NAME=delivery_tracker
   ```
   Remplacez `VOTRE_NOUVEAU_MOT_DE_PASSE` par le mot de passe que vous venez de créer.

8. **Testez la connexion** :
   ```bash
   python test_mongodb.py
   ```

## Alternative : Créer un nouvel utilisateur

Si vous préférez créer un nouvel utilisateur :

1. Dans MongoDB Atlas, allez dans **"Database Access"**
2. Cliquez sur **"+ ADD NEW DATABASE USER"**
3. Choisissez **"Password"** comme méthode d'authentification
4. Créez un nom d'utilisateur simple : `sitetrack_user`
5. Créez un mot de passe simple : `SiteTrack2024`
6. Rôle : **"Atlas admin"** ou **"Read and write to any database"**
7. Cliquez sur **"Add User"**
8. Mettez à jour votre `.env` avec le nouvel utilisateur :
   ```env
   MONGO_URL=mongodb+srv://sitetrack_user:SiteTrack2024@cluster00.w3eft3p.mongodb.net/
   DB_NAME=delivery_tracker
   ```

## Vérification finale

Une fois le mot de passe mis à jour, testez :
```bash
cd backend
source venv/bin/activate
python test_mongodb.py
```

Vous devriez voir : **"✅ Connexion MongoDB réussie !"**

Ensuite, redémarrez le serveur backend pour créer l'utilisateur admin :
```bash
uvicorn server:app --reload --port 8000
```

