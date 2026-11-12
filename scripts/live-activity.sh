#!/bin/sh
# Après avoir créé la cible « FrigiaLive » dans Xcode (voir MOBILE.md) : met l'affichage de Frigia à la place des fichiers d'exemple.
set -e
cd "$(dirname "$0")/../ios/App"
if [ ! -d FrigiaLive ]; then echo "Crée d'abord la cible FrigiaLive dans Xcode (voir MOBILE.md)."; exit 1; fi
find FrigiaLive -maxdepth 1 -name "*.swift" -delete
cp FrigiaLive-source/FrigiaLive.swift FrigiaLive/FrigiaLive.swift
echo "C'est fait. Dans Xcode : Product > Clean Build Folder, puis ▶."
