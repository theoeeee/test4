#!/usr/bin/env python3
"""Script pour tester la connexion MongoDB"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Charger les variables d'environnement
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'delivery_tracker')

print(f"🔍 Test de connexion MongoDB...")
print(f"URL: {mongo_url.replace(os.environ.get('MONGO_URL', '').split('@')[0].split('://')[1] if '@' in os.environ.get('MONGO_URL', '') else '', '***@') if '@' in mongo_url else mongo_url}")
print(f"Database: {db_name}")
print()

async def test_connection():
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        db = client[db_name]
        
        # Test de connexion
        await client.admin.command('ping')
        print("✅ Connexion MongoDB réussie !")
        
        # Vérifier si l'utilisateur admin existe
        admin = await db.users.find_one({"email": "admin@sitetrack.fr"})
        if admin:
            print("✅ Utilisateur admin trouvé dans la base de données")
        else:
            print("⚠️  Utilisateur admin non trouvé (sera créé au démarrage du serveur)")
        
        # Afficher le nombre de collections
        collections = await db.list_collection_names()
        print(f"📊 Collections trouvées: {', '.join(collections) if collections else 'Aucune'}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        print()
        print("💡 Vérifications à faire:")
        print("   1. Vérifiez que votre MONGO_URL dans .env est correcte")
        print("   2. Vérifiez que le mot de passe est correct (remplacez <db_password>)")
        print("   3. Pour MongoDB Atlas, vérifiez que votre IP est autorisée dans Network Access")
        print("   4. Vérifiez que votre cluster MongoDB Atlas est actif")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_connection())
    exit(0 if result else 1)

