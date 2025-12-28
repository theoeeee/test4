#!/usr/bin/env python3
"""Script pour créer un utilisateur dans MongoDB"""
import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'delivery_tracker')

async def create_user(email, password, name, role='driver'):
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        db = client[db_name]
        
        # Vérifier si l'utilisateur existe déjà
        existing = await db.users.find_one({"email": email})
        if existing:
            print(f"❌ L'utilisateur {email} existe déjà")
            client.close()
            return False
        
        # Créer le nouvel utilisateur
        user = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": password,  # Mot de passe en clair
            "name": name,
            "role": role
        }
        
        await db.users.insert_one(user)
        print(f"✅ Utilisateur créé avec succès:")
        print(f"   Email: {email}")
        print(f"   Nom: {name}")
        print(f"   Rôle: {role}")
        print(f"   Mot de passe: {password}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python create_user.py <email> <password> <name> [role]")
        print("Exemple: python create_user.py test@example.com motdepasse123 'Test User' driver")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    name = sys.argv[3]
    role = sys.argv[4] if len(sys.argv) > 4 else 'driver'
    
    asyncio.run(create_user(email, password, name, role))





