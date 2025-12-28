# 🔍 Vérification du fichier .env

## Format correct de l'URL MongoDB

Votre fichier `backend/.env` doit contenir exactement ceci (sans espaces, sans guillemets) :

```env
MONGO_URL=mongodb+srv://theolacome_db_user:VOTRE_MOT_DE_PASSE@cluster00.w3eft3p.mongodb.net/
DB_NAME=delivery_tracker
```

## ⚠️ Points importants :

1. **Remplacez `VOTRE_MOT_DE_PASSE`** par le vrai mot de passe de l'utilisateur `theolacome_db_user`

2. **Pas d'espaces** autour du `=` :
   - ✅ Correct : `MONGO_URL=mongodb+srv://...`
   - ❌ Incorrect : `MONGO_URL = mongodb+srv://...`

3. **Pas de guillemets** :
   - ✅ Correct : `MONGO_URL=mongodb+srv://...`
   - ❌ Incorrect : `MONGO_URL="mongodb+srv://..."`

4. **Caractères spéciaux dans le mot de passe** : Si votre mot de passe contient des caractères spéciaux, encodez-les :
   - `@` → `%40`
   - `#` → `%23`
   - `%` → `%25`
   - `&` → `%26`
   - `+` → `%2B`
   - `=` → `%3D`
   - `?` → `%3F`
   - `/` → `%2F`
   - `:` → `%3A`

## 📝 Exemple

Si votre mot de passe est `Mon@Mot#DePasse123`, l'URL sera :
```
MONGO_URL=mongodb+srv://theolacome_db_user:Mon%40Mot%23DePasse123@cluster00.w3eft3p.mongodb.net/
```

## 🔄 Pour retrouver/réinitialiser votre mot de passe

1. Allez sur https://cloud.mongodb.com/
2. Connectez-vous à votre compte
3. Allez dans **"Database Access"** (menu de gauche)
4. Trouvez l'utilisateur `theolacome_db_user`
5. Cliquez sur **"Edit"** puis **"Edit Password"**
6. Créez un nouveau mot de passe simple (sans caractères spéciaux pour éviter l'encodage)
7. Notez-le et mettez-le dans votre `.env`

## ✅ Test après modification

Après avoir modifié le fichier `.env`, testez avec :
```bash
cd backend
source venv/bin/activate
python test_mongodb.py
```

Si vous voyez "✅ Connexion MongoDB réussie !", c'est bon ! 🎉





