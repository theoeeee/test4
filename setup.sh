#!/bin/bash

# Script pour cloner SiteTrack et le pousser vers votre dépôt

echo "📥 Clonage du projet SiteTrack..."
git clone https://github.com/ethan-bns24/SiteTrack .

echo "🔧 Configuration du dépôt distant..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/theoeeee/test4.git

echo "📤 Poussage vers votre dépôt..."
git branch -M main
git push -u origin main

echo "✅ Terminé !"

