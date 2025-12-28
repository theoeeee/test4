#!/usr/bin/env python3
"""Script pour lister les utilisateurs dans MongoDB"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'delivery_tracker')

async def list_users():
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        db = client[db_name]
        
        print("📋 Liste des utilisateurs dans MongoDB:\n")
        users = await db.users.find({}).to_list(100)
        
        if not users:
            print("❌ Aucun utilisateur trouvé dans la base de données")
        else:
            for i, user in enumerate(users, 1):
                print(f"Utilisateur {i}:")
                print(f"  - Email: {user.get('email', 'N/A')}")
                print(f"  - Nom: {user.get('name', 'N/A')}")
                print(f"  - Rôle: {user.get('role', 'N/A')}")
                print(f"  - ID: {user.get('id', user.get('_id', 'N/A'))}")
                print(f"  - Mot de passe (premiers caractères): {user.get('password', 'N/A')[:5]}...")
                print()
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(list_users())





